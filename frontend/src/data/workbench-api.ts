import type {
  WorkbenchSession,
  IntentInput,
  IsolationResult,
  TestPlan,
  GenerationResult,
  TestRunResult,
  ReviewSummary,
} from '@/types/testlens';
import { getActiveRepoId } from './dashboard-api';
import { mockWorkbench } from './generateTestsMockData';

/**
 * Seam between the Generate/Improve workbench UI and its backend.
 *
 * - No `VITE_API_BASE_URL` → resolves slices of the mock session (with small
 *   delays so pending states are exercised).
 * - Configured → calls the `/workbench/...` endpoints (contract §4).
 *
 * Each transition returns the contract slice it produces; the hook merges it
 * into the session, so mock and real share one code path.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export type JobStep = 'isolation' | 'plan' | 'generate' | 'run' | 'review';

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

export interface JobEvent {
  type: 'status' | 'progress' | 'thinking' | 'artifact' | 'screenshot' | 'result' | 'error';
  jobId: string;
  step: JobStep;
  payload?: JobResult;
  message?: string;
  status?: string;
}

export class WorkbenchApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbenchApiError';
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new WorkbenchApiError(`${path} failed (${res.status} ${res.statusText})`);
  return (await res.json()) as T;
}

const repoId = () => getActiveRepoId() ?? 'mock';

const JOB_ENDPOINT_BY_STEP: Record<JobStep, string> = {
  isolation: 'analyze',
  plan: 'plan',
  generate: 'generate',
  run: 'run',
  review: 'review',
};

async function runJob<T extends JobResult>(
  sessionId: string,
  step: JobStep,
  onEvent?: (event: JobEvent) => void,
): Promise<T> {
  const endpoint = JOB_ENDPOINT_BY_STEP[step];
  const start = await post<JobStartResponse>(`/api/workbench/${sessionId}/${endpoint}/jobs`);

  return new Promise<T>((resolve, reject) => {
    const source = new EventSource(`${API_BASE}/api/workbench/${sessionId}/jobs/${start.jobId}/events`);
    let settled = false;

    const close = () => source.close();
    const settleResolve = (value: T) => {
      if (settled) return;
      settled = true;
      close();
      resolve(value);
    };
    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      close();
      reject(error);
    };
    const parseEvent = (event: Event) => JSON.parse((event as MessageEvent).data) as JobEvent;

    source.addEventListener('result', event => {
      const parsed = parseEvent(event);
      onEvent?.(parsed);
      settleResolve(parsed.payload as T);
    });

    source.addEventListener('error', event => {
      const data = (event as MessageEvent).data;
      if (data) {
        onEvent?.(JSON.parse(data) as JobEvent);
      }
      settleReject(new WorkbenchApiError(`Job ${start.jobId} failed`));
    });

    source.onerror = () => {
      if (settled) return;
      settleReject(new WorkbenchApiError(`Job ${start.jobId} event stream disconnected`));
    };

    ['status', 'progress', 'thinking', 'artifact', 'screenshot'].forEach(type => {
      source.addEventListener(type, event => {
        onEvent?.(parseEvent(event));
      });
    });
  });
}

/** S1 — create a session from the user's intent. */
export async function createWorkbenchSession(intent?: Partial<IntentInput>): Promise<WorkbenchSession> {
  if (!API_BASE) {
    await delay(300);
    return { ...mockWorkbench, intent: { ...mockWorkbench.intent, ...intent } };
  }
  return post<WorkbenchSession>('/api/workbench/sessions', { repoId: repoId(), intent });
}

/** S2 — isolate & classify the requested behavior. */
export async function analyzeSession(id: string, onEvent?: (event: JobEvent) => void): Promise<IsolationResult> {
  if (!API_BASE) {
    await delay(1500);
    if (!mockWorkbench.isolation) throw new WorkbenchApiError('No isolation result in mock');
    return mockWorkbench.isolation;
  }
  return runJob<IsolationResult>(id, 'isolation', onEvent);
}

/** S3 — produce the proposed test plan. */
export async function planSession(id: string, onEvent?: (event: JobEvent) => void): Promise<TestPlan> {
  if (!API_BASE) {
    await delay(2000);
    if (!mockWorkbench.plan) throw new WorkbenchApiError('No plan in mock');
    return mockWorkbench.plan;
  }
  return runJob<TestPlan>(id, 'plan', onEvent);
}

/** S4 — generate the proposed test changes. */
export async function generateSession(id: string, onEvent?: (event: JobEvent) => void): Promise<GenerationResult> {
  if (!API_BASE) {
    await delay(600);
    if (!mockWorkbench.generation) throw new WorkbenchApiError('No generation result in mock');
    return mockWorkbench.generation;
  }
  return runJob<GenerationResult>(id, 'generate', onEvent);
}

/** S5 — run the generated tests. */
export async function runSession(id: string, onEvent?: (event: JobEvent) => void): Promise<TestRunResult> {
  if (!API_BASE) {
    await delay(400);
    if (!mockWorkbench.run) throw new WorkbenchApiError('No run result in mock');
    return mockWorkbench.run;
  }
  return runJob<TestRunResult>(id, 'run', onEvent);
}

/** S6 — summarize the generated changes and remaining risk. */
export async function reviewSession(id: string, onEvent?: (event: JobEvent) => void): Promise<ReviewSummary> {
  if (!API_BASE) {
    await delay(400);
    if (!mockWorkbench.review) throw new WorkbenchApiError('No review summary in mock');
    return mockWorkbench.review;
  }
  return runJob<ReviewSummary>(id, 'review', onEvent);
}
