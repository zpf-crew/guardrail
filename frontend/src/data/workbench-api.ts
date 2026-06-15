import type {
  WorkbenchSession,
  IntentInput,
  IsolationResult,
  TestPlan,
  PlanApproval,
  GenerationResult,
  TestRunResult,
  ReviewSummary,
  Evidence,
} from '@/types/testlens';
import { getActiveRepoId } from './dashboard-api';
import {
  isMockMode,
  mockSession,
  mockIsolation,
  mockPlan,
  mockGeneration,
  mockRun,
  mockReview,
  mockStream,
} from './mock-workbench';

/**
 * Seam between the Generate/Improve workbench UI and the workbench backend.
 * All steps call the real API and stream SSE job events.
 */

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = configuredApiBase && configuredApiBase.length > 0
  ? configuredApiBase
  : '';

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

async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new WorkbenchApiError(`${path} failed (${res.status} ${res.statusText})`);
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  return request<T>('GET', path);
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
    matrix: run.matrix.map(row => ({
      ...row,
      evidenceItems: row.evidenceItems?.map(normalizeEvidence),
    })),
  };
}

function normalizeWorkbenchSession(session: WorkbenchSession): WorkbenchSession {
  if (!session.run) return session;
  return { ...session, run: normalizeRunResult(session.run) };
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
  body?: unknown,
): Promise<T> {
  const endpoint = JOB_ENDPOINT_BY_STEP[step];
  const start = await post<JobStartResponse>(
    `/api/workbench/${sessionId}/${endpoint}/jobs`,
    body,
  );

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
        const errorEvent = parsed as Extract<JobEvent, { type: 'error' }>;
        settleReject(new WorkbenchApiError(errorEvent.message));
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
  if (isMockMode()) return mockSession();
  const repoId = getActiveRepoId();
  if (!repoId) {
    throw new WorkbenchApiError('Complete onboarding and select a repository first.');
  }
  return post<WorkbenchSession>('/api/workbench/sessions', { repoId, intent });
}

/** Load an existing workbench session (for URL restore after reload). */
export async function fetchWorkbenchSession(sessionId: string): Promise<WorkbenchSession> {
  if (isMockMode()) return mockSession();
  const session = await get<WorkbenchSession>(`/api/workbench/${sessionId}`);
  return normalizeWorkbenchSession(session);
}

export async function updateWorkbenchIntent(id: string, intent: IntentInput): Promise<WorkbenchSession> {
  if (isMockMode()) return { ...mockSession(), intent: { ...mockSession().intent, ...intent } };
  return patch<WorkbenchSession>(`/api/workbench/${id}`, { intent });
}

/** S2 — isolate & classify the requested behavior. */
export async function analyzeSession(id: string, onEvent?: (event: JobEvent) => void): Promise<IsolationResult> {
  if (isMockMode()) { await mockStream(onEvent, 'isolation', ['Loading repository context…', 'Classifying behaviors…']); return mockIsolation(); }
  return runJob<IsolationResult>(id, 'isolation', onEvent);
}

/** S3 — produce the proposed test plan. */
export async function planSession(id: string, onEvent?: (event: JobEvent) => void): Promise<TestPlan> {
  if (isMockMode()) { await mockStream(onEvent, 'plan', ['Drafting plan…', 'Assessing risk…']); return mockPlan(); }
  return runJob<TestPlan>(id, 'plan', onEvent);
}

/** S4 — generate the proposed test changes. */
export async function generateSession(
  id: string,
  approval: PlanApproval = { decision: 'approve', answers: {} },
  onEvent?: (event: JobEvent) => void,
): Promise<GenerationResult> {
  if (isMockMode()) { await mockStream(onEvent, 'generate', ['Drafting Gherkin scenarios…', 'Staging feature files…']); return mockGeneration(); }
  return runJob<GenerationResult>(id, 'generate', onEvent, { approval });
}

/** S5 — run the generated tests. */
export async function runSession(id: string, onEvent?: (event: JobEvent) => void): Promise<TestRunResult> {
  if (isMockMode()) { await mockStream(onEvent, 'run', ['Starting dev server…', 'Running UI flows…', 'Summarizing evidence…']); return mockRun(); }
  return runJob<TestRunResult>(id, 'run', onEvent);
}

/** S6 — summarize the generated changes and remaining risk. */
export async function reviewSession(id: string, onEvent?: (event: JobEvent) => void): Promise<ReviewSummary> {
  if (isMockMode()) { await mockStream(onEvent, 'review', ['Summarizing review…']); return mockReview(); }
  return runJob<ReviewSummary>(id, 'review', onEvent);
}

export interface CreatePullRequestResult {
  url: string;
  branch: string;
}

/** S6 — write the generated tests to a branch and open a GitHub pull request. Returns the PR URL. */
export async function createSessionPullRequest(id: string): Promise<CreatePullRequestResult> {
  if (isMockMode()) {
    await mockStream(undefined, 'review', []);
    return { url: 'https://github.com/example/repo/pull/1', branch: 'guardrail/add-tests-mock' };
  }
  return post<CreatePullRequestResult>(`/api/workbench/${id}/pull-request`);
}
