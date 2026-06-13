import { basename, join } from 'node:path';
import { modelConnect } from '../model-connect/index.js';
import { StructuredModelRunner } from './model/structured-model-runner.js';
import { SkillContractLoader, type SkillContract } from './skills/skill-contract-loader.js';
import type { TestTypeAdapter } from './adapters/test-type-adapter.js';
import type { RegisteredArtifact, WorkbenchArtifactStore } from './artifacts/workbench-artifact-store.js';
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
  RepoRef,
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
type ArtifactAdapterEvent = AdapterEvent & {
  type: 'artifact' | 'screenshot';
  artifact: TestRunResult['ui']['evidence'][number];
};

export interface WorkbenchServiceTestHooks {
  structuredModel?: Pick<StructuredModelRunner, 'runStep'>;
  skills?: { load(name: string): Promise<SkillContract> };
}

export class WorkbenchService {
  constructor(
    private readonly store: WorkbenchJobStore,
    private readonly queue: WorkbenchJobQueue,
    private readonly eventBus: WorkbenchJobEventBus,
    private readonly artifactStore: WorkbenchArtifactStore,
    private readonly repositoryProvider: RepositoryContextProvider,
    private readonly adapters: TestTypeAdapter[],
    private readonly testHooks?: WorkbenchServiceTestHooks,
  ) {}

  createSession(
    repoId: string,
    userId: string,
    repo: RepoRef,
    intent?: Partial<IntentInput>,
  ): WorkbenchSession {
    return this.store.createSession({ repoId, userId, repo, intent });
  }

  updateSessionIntent(sessionId: string, intent: Partial<IntentInput>): WorkbenchSession {
    this.requireSession(sessionId);
    return this.store.updateSessionIntent(sessionId, intent);
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
        const repository = await this.repositoryProvider.getContext(
          currentSession.repoId,
          currentSession.userId,
          currentSession.intent,
        );
        const adapter = this.requireUiBrowserAdapter();
        const repoRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
        const skills = (this.testHooks?.skills
          ?? new SkillContractLoader({ skillsDir: join(repoRoot, 'guardrail-skills') })) as SkillContractLoader;
        const structuredModel = (this.testHooks?.structuredModel
          ?? new StructuredModelRunner({ modelConnect })) as StructuredModelRunner;
        const baseInput = {
          session: currentSession,
          repository,
          modelConnect,
          skills,
          structuredModel,
          signal,
          emit: (event: AdapterEvent) => this.emit(session.id, job.id, event),
        };

        const rawResult = await this.runAdapterStep(adapter, step, baseInput, currentSession, approval);
        const result = await this.normalizeStepResult(session.id, job.id, step, rawResult);
        this.setStepResult(session.id, step, result);
        await this.emit(session.id, job.id, { type: 'result', payload: result });
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

  getArtifact(sessionId: string, artifactId: string): RegisteredArtifact | undefined {
    this.requireSession(sessionId);
    return this.artifactStore.getArtifact(sessionId, artifactId);
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
    const job = this.requireJob(sessionId, jobId);
    this.store.setJobStatus(sessionId, jobId, status);
    if (status === 'queued' || status === 'running') {
      this.store.setStepStatus(sessionId, job.step, 'active');
    }
    if (status === 'failed' || status === 'timeout') {
      this.store.setStepStatus(sessionId, job.step, 'warn');
    }
    this.emitSafely(sessionId, jobId, { type: 'status', status });
  }

  private onError(sessionId: string, jobId: string, message: string): void {
    const job = this.requireJob(sessionId, jobId);
    this.store.setJobStatus(sessionId, jobId, job.status, message);
    this.store.setStepStatus(sessionId, job.step, 'warn');
    this.emitSafely(sessionId, jobId, { type: 'error', message, retryable: statusIsRetryable(message) });
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

  private async normalizeStepResult(
    sessionId: string,
    jobId: string,
    step: WorkbenchJobStep,
    result: IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary,
  ): Promise<IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary> {
    if (step !== 'run') return result;

    const run = result as TestRunResult;
    const evidence = await Promise.all(
      run.ui.evidence.map(item => this.normalizeResultEvidence(sessionId, jobId, item)),
    );
    return { ...run, ui: { ...run.ui, evidence } };
  }

  private async normalizeResultEvidence(
    sessionId: string,
    jobId: string,
    evidence: TestRunResult['ui']['evidence'][number],
  ): Promise<TestRunResult['ui']['evidence'][number]> {
    if (evidence.kind === 'screenshot' && evidence.href?.startsWith(`/api/workbench/${sessionId}/artifacts/`)) {
      return evidence;
    }
    return this.artifactStore.registerEvidence({ sessionId, jobId, evidence });
  }

  private async emit(sessionId: string, jobId: string, event: AdapterEvent): Promise<AdapterEvent> {
    const job = this.requireJob(sessionId, jobId);
    const normalizedEvent = shouldNormalizeArtifactEvent(event)
      ? await this.normalizeArtifactEvent(sessionId, jobId, event)
      : event;
    const normalized = { ...normalizedEvent, jobId, step: job.step } as WorkbenchJobEvent;
    this.store.appendEvent(sessionId, jobId, normalized);
    this.eventBus.publish(eventKey(sessionId, jobId), normalized);
    return normalizedEvent;
  }

  private emitSafely(sessionId: string, jobId: string, event: AdapterEvent): void {
    this.emit(sessionId, jobId, event).catch(() => {
      // Queue callbacks must remain sync-safe; failed event publication should
      // not surface as an unhandled rejection or compromise queue liveness.
    });
  }

  private async normalizeArtifactEvent(sessionId: string, jobId: string, event: ArtifactAdapterEvent): Promise<AdapterEvent> {
    const artifact = await this.artifactStore.registerEvidence({ sessionId, jobId, evidence: event.artifact });
    return { ...event, artifact } as AdapterEvent;
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

function shouldNormalizeArtifactEvent(
  event: AdapterEvent,
): event is ArtifactAdapterEvent {
  return (event.type === 'screenshot' || event.type === 'artifact') && event.artifact.kind === 'screenshot';
}
