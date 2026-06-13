import { modelConnect } from '../model-connect/index.js';
import type { TestTypeAdapter } from './adapters/test-type-adapter.js';
import type { WorkbenchJobEventBus } from './jobs/job-events.js';
import type { WorkbenchJobQueue } from './jobs/job-queue.js';
import { WORKBENCH_STEP_TIMEOUT_MS } from './jobs/job-timeouts.js';
import type { WorkbenchJobStore } from './jobs/job-store.js';
import type { RepositoryContextProvider } from './repositories/repository-context-provider.js';
import type {
  GenerationResult,
  IntentInput,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  TestPlan,
  TestRunResult,
  WorkbenchJob,
  WorkbenchJobEvent,
  WorkbenchJobStatus,
  WorkbenchSession,
  WorkflowStepId,
} from './workbench.types.js';

type WorkbenchJobStep = Exclude<WorkflowStepId, 'intent'>;
type AdapterEvent = WorkbenchJobEvent extends infer Event
  ? Event extends WorkbenchJobEvent
    ? Omit<Event, 'jobId' | 'step'>
    : never
  : never;

export class WorkbenchService {
  constructor(
    private readonly store: WorkbenchJobStore,
    private readonly queue: WorkbenchJobQueue,
    private readonly eventBus: WorkbenchJobEventBus,
    private readonly repositoryProvider: RepositoryContextProvider,
    private readonly adapters: TestTypeAdapter[],
  ) {}

  createSession(intent?: Partial<IntentInput>): WorkbenchSession {
    return this.store.createSession(intent);
  }

  startJob(
    sessionId: string,
    step: WorkbenchJobStep,
    approval: PlanApproval = { decision: 'approve', answers: {} },
  ): WorkbenchJob {
    const session = this.requireSession(sessionId);
    const job = this.store.createJob(session.id, step);

    void this.queue.enqueue({
      timeoutMs: WORKBENCH_STEP_TIMEOUT_MS[step],
      onStatus: status => this.onStatus(session.id, job.id, status),
      onError: message => this.onError(session.id, job.id, message),
      run: async signal => {
        const currentSession = this.requireSession(session.id);
        const repository = await this.repositoryProvider.getContext(currentSession.repo.name);
        const adapter = this.requireUiBrowserAdapter();
        const baseInput = {
          session: currentSession,
          repository,
          modelConnect,
          signal,
          emit: (event: AdapterEvent) => this.emit(session.id, job.id, event),
        };

        const result = await this.runAdapterStep(adapter, step, baseInput, currentSession, approval);
        this.setStepResult(session.id, step, result);
        this.emit(session.id, job.id, { type: 'result', payload: result });
      },
    });

    return job;
  }

  getJobSnapshot(
    sessionId: string,
    jobId: string,
  ): { job: WorkbenchJob; events: WorkbenchJobEvent[]; session: WorkbenchSession } {
    const session = this.requireSession(sessionId);
    const job = this.requireJob(sessionId, jobId);
    const events = this.store.getEvents(sessionId, jobId);
    return { job, events, session };
  }

  subscribe(
    sessionId: string,
    jobId: string,
    listener: (event: WorkbenchJobEvent) => void,
  ): () => void {
    this.requireJob(sessionId, jobId);
    return this.eventBus.subscribe(eventKey(sessionId, jobId), listener);
  }

  private async runAdapterStep(
    adapter: TestTypeAdapter,
    step: WorkbenchJobStep,
    baseInput: Parameters<TestTypeAdapter['analyze']>[0],
    session: WorkbenchSession,
    approval: PlanApproval,
  ): Promise<IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary> {
    switch (step) {
      case 'isolation':
        return adapter.analyze(baseInput);
      case 'plan':
        if (!session.isolation) throw new Error('Cannot plan before isolation result exists.');
        return adapter.plan({ ...baseInput, isolation: session.isolation });
      case 'generate':
        if (!session.plan) throw new Error('Cannot generate before plan result exists.');
        return adapter.generate({ ...baseInput, plan: session.plan, approval });
      case 'run':
        if (!session.generation) throw new Error('Cannot run before generation result exists.');
        return adapter.run({ ...baseInput, generation: session.generation });
      case 'review':
        if (!session.generation) throw new Error('Cannot review before generation result exists.');
        if (!session.run) throw new Error('Cannot review before run result exists.');
        return adapter.review({ ...baseInput, generation: session.generation, run: session.run });
    }
  }

  private onStatus(
    sessionId: string,
    jobId: string,
    status: WorkbenchJobStatus,
  ): void {
    this.store.setJobStatus(sessionId, jobId, status);
    this.emit(sessionId, jobId, { type: 'status', status });
  }

  private onError(sessionId: string, jobId: string, message: string): void {
    const job = this.requireJob(sessionId, jobId);
    this.store.setJobStatus(sessionId, jobId, job.status, message);
    this.emit(sessionId, jobId, { type: 'error', message, retryable: statusIsRetryable(message) });
  }

  private setStepResult(
    sessionId: string,
    step: WorkbenchJobStep,
    result: IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary,
  ): void {
    switch (step) {
      case 'isolation':
        this.store.setStepResult(sessionId, step, result as IsolationResult);
        break;
      case 'plan':
        this.store.setStepResult(sessionId, step, result as TestPlan);
        break;
      case 'generate':
        this.store.setStepResult(sessionId, step, result as GenerationResult);
        break;
      case 'run':
        this.store.setStepResult(sessionId, step, result as TestRunResult);
        break;
      case 'review':
        this.store.setStepResult(sessionId, step, result as ReviewSummary);
        break;
    }
  }

  private emit(sessionId: string, jobId: string, event: AdapterEvent): void {
    const job = this.requireJob(sessionId, jobId);
    const normalized = { ...event, jobId, step: job.step } as WorkbenchJobEvent;
    this.store.appendEvent(sessionId, jobId, normalized);
    this.eventBus.publish(eventKey(sessionId, jobId), normalized);
  }

  private requireSession(sessionId: string): WorkbenchSession {
    const session = this.store.getSession(sessionId);
    if (!session) throw new Error(`Workbench session not found: ${sessionId}`);
    return session;
  }

  private requireJob(sessionId: string, jobId: string): WorkbenchJob {
    const job = this.store.getJob(sessionId, jobId);
    if (!job) throw new Error(`Workbench job not found: ${jobId}`);
    return job;
  }

  private requireUiBrowserAdapter(): TestTypeAdapter {
    const adapter = this.adapters.find(item => item.testType === 'UI / Browser');
    if (!adapter) throw new Error('UI / Browser workbench adapter is not configured.');
    return adapter;
  }
}

function eventKey(sessionId: string, jobId: string): string {
  return `${sessionId}:${jobId}`;
}

function statusIsRetryable(message: string): boolean {
  return /timeout|timed out|abort/i.test(message);
}
