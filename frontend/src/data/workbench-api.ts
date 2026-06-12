import type {
  WorkbenchSession,
  IntentInput,
  IsolationResult,
  TestPlan,
  TestRunResult,
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

/** S1 — create a session from the user's intent. */
export async function createWorkbenchSession(intent?: Partial<IntentInput>): Promise<WorkbenchSession> {
  if (!API_BASE) {
    await delay(300);
    return { ...mockWorkbench, intent: { ...mockWorkbench.intent, ...intent } };
  }
  return post<WorkbenchSession>('/api/workbench/sessions', { repoId: repoId(), intent });
}

/** S2 — isolate & classify the requested behavior. */
export async function analyzeSession(id: string): Promise<IsolationResult> {
  if (!API_BASE) {
    await delay(1500);
    if (!mockWorkbench.isolation) throw new WorkbenchApiError('No isolation result in mock');
    return mockWorkbench.isolation;
  }
  return post<IsolationResult>(`/api/workbench/${id}/analyze`);
}

/** S3 — produce the proposed test plan. */
export async function planSession(id: string): Promise<TestPlan> {
  if (!API_BASE) {
    await delay(2000);
    if (!mockWorkbench.plan) throw new WorkbenchApiError('No plan in mock');
    return mockWorkbench.plan;
  }
  return post<TestPlan>(`/api/workbench/${id}/plan`);
}

/** S5 — run the generated tests. */
export async function runSession(id: string): Promise<TestRunResult> {
  if (!API_BASE) {
    await delay(400);
    if (!mockWorkbench.run) throw new WorkbenchApiError('No run result in mock');
    return mockWorkbench.run;
  }
  return post<TestRunResult>(`/api/workbench/${id}/run`);
}
