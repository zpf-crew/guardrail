import type {
  WorkbenchSession,
  IntentInput,
  IsolationResult,
  TestPlan,
  GenerationResult,
  TestRunResult,
  ReviewSummary,
  Evidence,
} from '@/types/testlens';
import { getActiveRepoId } from './dashboard-api';
import { mockWorkbenchForIntent } from './generateTestsMockData';

/**
 * Seam between the Generate/Improve workbench UI and its backend.
 *
 * - Default → calls the local workbench backend so UI Browser runs can capture
 *   real agent-browser evidence.
 * - `VITE_WORKBENCH_USE_MOCK=true` → resolves slices of the mock session.
 *
 * Each transition returns the contract slice it produces; the hook merges it
 * into the session, so mock and real share one code path.
 */

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = configuredApiBase && configuredApiBase.length > 0
  ? configuredApiBase
  : 'http://localhost:3000';
const USE_MOCK = import.meta.env.VITE_WORKBENCH_USE_MOCK === 'true';
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const mockSessions = new Map<string, WorkbenchSession>();

export type JobStep = 'isolation' | 'plan' | 'generate' | 'run' | 'review';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout';

export interface JobStartResponse {
  jobId: string;
  step: JobStep;
}

export type JobResult =
  | IsolationResult
  | TestPlan
  | GenerationResult
  | TestRunResult
  | ReviewSummary;

interface BaseJobEvent {
  jobId: string;
  step: JobStep;
}

export type JobEvent =
  | (BaseJobEvent & { type: 'status'; status: JobStatus })
  | (BaseJobEvent & { type: 'progress'; percent?: number; message: string })
  | (BaseJobEvent & { type: 'thinking'; message: string })
  | (BaseJobEvent & { type: 'artifact'; artifact: Evidence })
  | (BaseJobEvent & { type: 'screenshot'; step: 'run'; artifact: Evidence })
  | (BaseJobEvent & { type: 'result'; payload: JobResult })
  | (BaseJobEvent & { type: 'error'; message: string; retryable: boolean });

export class WorkbenchApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbenchApiError';
  }
}

async function request<T>(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new WorkbenchApiError(`${path} failed (${res.status} ${res.statusText})`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

function absoluteArtifactHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (/^[a-z][a-z\d+\-.]*:/i.test(href)) return href;
  if (!href.startsWith('/api/')) return href;
  return `${API_BASE.replace(/\/$/, '')}${href}`;
}

function normalizeEvidence(evidence: Evidence): Evidence {
  return { ...evidence, href: absoluteArtifactHref(evidence.href) };
}

function normalizeRunResult(run: TestRunResult): TestRunResult {
  return {
    ...run,
    ui: { ...run.ui, evidence: run.ui.evidence.map(normalizeEvidence) },
    mobile: { ...run.mobile, evidence: run.mobile.evidence.map(normalizeEvidence) },
  };
}

function normalizeJobResult<T extends JobResult>(result: T): T {
  if (result && typeof result === 'object' && 'ui' in result && 'mobile' in result && 'matrix' in result) {
    return normalizeRunResult(result as TestRunResult) as T;
  }
  return result;
}

function normalizeJobEvent(event: JobEvent): JobEvent {
  if (event.type === 'screenshot' || event.type === 'artifact') {
    return { ...event, artifact: normalizeEvidence(event.artifact) };
  }
  if (event.type === 'result') {
    return { ...event, payload: normalizeJobResult(event.payload) };
  }
  return event;
}

function mockSession(id: string): WorkbenchSession {
  return mockSessions.get(id) ?? mockWorkbenchForIntent();
}

const JOB_ENDPOINT_BY_STEP: Record<JobStep, string> = {
  isolation: 'analyze',
  plan: 'plan',
  generate: 'generate',
  run: 'run',
  review: 'review',
};

async function consumeJobEventStream(
  url: string,
  onSseEvent: (eventType: string, data: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok || !res.body) {
    throw new WorkbenchApiError(`Job event stream failed (${res.status} ${res.statusText})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventType = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) data = line.slice(6);
      }

      if (data) onSseEvent(eventType, data);
      boundary = buffer.indexOf('\n\n');
    }
  }
}

async function runJob<T extends JobResult>(
  sessionId: string,
  step: JobStep,
  onEvent?: (event: JobEvent) => void,
): Promise<T> {
  const endpoint = JOB_ENDPOINT_BY_STEP[step];
  const start = await post<JobStartResponse>(`/api/workbench/${sessionId}/${endpoint}/jobs`);

  return new Promise<T>((resolve, reject) => {
    const abortController = new AbortController();
    let settled = false;

    const settleResolve = (value: T) => {
      if (settled) return;
      settled = true;
      abortController.abort();
      resolve(value);
    };
    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      abortController.abort();
      reject(error);
    };

    const handleSseEvent = (eventType: string, data: string) => {
      const parsed = normalizeJobEvent(JSON.parse(data) as JobEvent);
      onEvent?.(parsed);

      if (eventType === 'result') {
        const resultEvent = parsed as Extract<JobEvent, { type: 'result' }>;
        settleResolve(resultEvent.payload as T);
      } else if (eventType === 'error') {
        settleReject(new WorkbenchApiError(`Job ${start.jobId} failed`));
      }
    };

    void consumeJobEventStream(
      `${API_BASE}/api/workbench/${sessionId}/jobs/${start.jobId}/events`,
      handleSseEvent,
      abortController.signal,
    )
      .then(() => {
        if (!settled) {
          settleReject(new WorkbenchApiError(`Job ${start.jobId} event stream disconnected`));
        }
      })
      .catch(error => {
        if (settled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        settleReject(error instanceof Error ? error : new WorkbenchApiError(`Job ${start.jobId} event stream failed`));
      });
  });
}

/** S1 — create a session from the user's intent. */
export async function createWorkbenchSession(intent?: Partial<IntentInput>): Promise<WorkbenchSession> {
  if (USE_MOCK) {
    await delay(300);
    const session = mockWorkbenchForIntent(intent);
    mockSessions.set(session.id, session);
    return session;
  }
  const repoId = getActiveRepoId();
  if (!repoId) {
    throw new WorkbenchApiError('Complete onboarding and select a repository first.');
  }
  return post<WorkbenchSession>('/api/workbench/sessions', { repoId, intent });
}

export async function updateWorkbenchIntent(id: string, intent: IntentInput): Promise<WorkbenchSession> {
  if (USE_MOCK) {
    await delay(100);
    const session = { ...mockWorkbenchForIntent(intent), id };
    mockSessions.set(id, session);
    return session;
  }
  return patch<WorkbenchSession>(`/api/workbench/${id}`, { intent });
}

/** S2 — isolate & classify the requested behavior. */
export async function analyzeSession(id: string, onEvent?: (event: JobEvent) => void): Promise<IsolationResult> {
  if (USE_MOCK) {
    await delay(1500);
    const session = mockSession(id);
    if (!session.isolation) throw new WorkbenchApiError('No isolation result in mock');
    return session.isolation;
  }
  return runJob<IsolationResult>(id, 'isolation', onEvent);
}

/** S3 — produce the proposed test plan. */
export async function planSession(id: string, onEvent?: (event: JobEvent) => void): Promise<TestPlan> {
  if (USE_MOCK) {
    await delay(2000);
    const session = mockSession(id);
    if (!session.plan) throw new WorkbenchApiError('No plan in mock');
    return session.plan;
  }
  return runJob<TestPlan>(id, 'plan', onEvent);
}

/** S4 — generate the proposed test changes. */
export async function generateSession(id: string, onEvent?: (event: JobEvent) => void): Promise<GenerationResult> {
  if (USE_MOCK) {
    await delay(600);
    const session = mockSession(id);
    if (!session.generation) throw new WorkbenchApiError('No generation result in mock');
    return session.generation;
  }
  return runJob<GenerationResult>(id, 'generate', onEvent);
}

/** S5 — run the generated tests. */
export async function runSession(id: string, onEvent?: (event: JobEvent) => void): Promise<TestRunResult> {
  if (USE_MOCK) {
    await delay(400);
    const session = mockSession(id);
    if (!session.run) throw new WorkbenchApiError('No run result in mock');
    return session.run;
  }
  return runJob<TestRunResult>(id, 'run', onEvent);
}

/** S6 — summarize the generated changes and remaining risk. */
export async function reviewSession(id: string, onEvent?: (event: JobEvent) => void): Promise<ReviewSummary> {
  if (USE_MOCK) {
    await delay(400);
    const session = mockSession(id);
    if (!session.review) throw new WorkbenchApiError('No review summary in mock');
    return session.review;
  }
  return runJob<ReviewSummary>(id, 'review', onEvent);
}
