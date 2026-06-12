import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  IntentInput,
  RepoRef,
  WorkbenchJob,
  WorkbenchJobEvent,
  WorkbenchJobStatus,
  WorkbenchSession,
  WorkbenchStepResult,
  WorkflowStepId,
} from '../workbench.types.js';

const DEFAULT_REPO: RepoRef = {
  name: 'guardrail',
  path: path.basename(process.cwd()) === 'backend' ? path.dirname(process.cwd()) : process.cwd(),
  branch: 'main',
};

const DEFAULT_INTENT: IntentInput = {
  prompt: '',
  feature: null,
  testTypes: [],
  sources: [],
};

export class WorkbenchJobStore {
  private readonly sessions = new Map<string, WorkbenchSession>();
  private readonly jobs = new Map<string, Map<string, WorkbenchJob>>();
  private readonly events = new Map<string, Map<string, WorkbenchJobEvent[]>>();

  createSession(intent: Partial<IntentInput> = {}): WorkbenchSession {
    const session: WorkbenchSession = {
      id: randomUUID(),
      repo: DEFAULT_REPO,
      createdAt: new Date().toISOString(),
      steps: {
        intent: 'active',
        isolation: 'locked',
        plan: 'locked',
        generate: 'locked',
        run: 'locked',
        review: 'locked',
      },
      intent: { ...DEFAULT_INTENT, ...intent },
    };

    this.sessions.set(session.id, session);
    this.jobs.set(session.id, new Map());
    this.events.set(session.id, new Map());

    return session;
  }

  createJob(sessionId: string, step: WorkflowStepId): WorkbenchJob {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Workbench session not found: ${sessionId}`);

    const now = new Date().toISOString();
    const job: WorkbenchJob = {
      id: randomUUID(),
      sessionId,
      step,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    this.jobsFor(sessionId).set(job.id, job);
    this.eventsFor(sessionId).set(job.id, []);

    return job;
  }

  getSession(sessionId: string): WorkbenchSession | undefined {
    return this.sessions.get(sessionId);
  }

  getJob(sessionId: string, jobId: string): WorkbenchJob | undefined {
    return this.jobs.get(sessionId)?.get(jobId);
  }

  setJobStatus(
    sessionId: string,
    jobId: string,
    status: WorkbenchJobStatus,
    error?: string,
  ): void {
    const job = this.getJob(sessionId, jobId);
    if (!job) throw new Error(`Workbench job not found: ${jobId}`);

    job.status = status;
    job.updatedAt = new Date().toISOString();
    if (error) job.error = error;
    else delete job.error;
  }

  appendEvent(sessionId: string, jobId: string, event: WorkbenchJobEvent): void {
    const events = this.events.get(sessionId)?.get(jobId);
    if (!events) throw new Error(`Workbench job events not found: ${jobId}`);

    events.push(event);
  }

  getEvents(sessionId: string, jobId: string): WorkbenchJobEvent[] {
    return [...(this.events.get(sessionId)?.get(jobId) ?? [])];
  }

  setStepResult(sessionId: string, step: WorkflowStepId, result: WorkbenchStepResult): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Workbench session not found: ${sessionId}`);

    switch (step) {
      case 'isolation':
        session.isolation = result as WorkbenchSession['isolation'];
        break;
      case 'plan':
        session.plan = result as WorkbenchSession['plan'];
        break;
      case 'generate':
        session.generation = result as WorkbenchSession['generation'];
        break;
      case 'run':
        session.run = result as WorkbenchSession['run'];
        break;
      case 'review':
        session.review = result as WorkbenchSession['review'];
        break;
      case 'intent':
        break;
    }

    session.steps[step] = 'done';
  }

  private jobsFor(sessionId: string): Map<string, WorkbenchJob> {
    const jobs = this.jobs.get(sessionId);
    if (!jobs) throw new Error(`Workbench session jobs not found: ${sessionId}`);
    return jobs;
  }

  private eventsFor(sessionId: string): Map<string, WorkbenchJobEvent[]> {
    const events = this.events.get(sessionId);
    if (!events) throw new Error(`Workbench session events not found: ${sessionId}`);
    return events;
  }
}
