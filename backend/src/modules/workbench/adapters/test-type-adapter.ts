import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';
import type {
  GenerationResult,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  TestPlan,
  TestRunResult,
  TestType,
  WorkbenchJobEvent,
  WorkbenchSession,
} from '../workbench.types.js';

type AdapterEvent = WorkbenchJobEvent extends infer Event
  ? Event extends WorkbenchJobEvent
    ? Omit<Event, 'jobId' | 'step'>
    : never
  : never;

export interface AdapterInput {
  session: WorkbenchSession;
  repository: RepositoryContext;
  emit: (event: AdapterEvent) => void;
  modelConnect: ModelConnect | null;
  signal: AbortSignal;
}

export interface TestTypeAdapter {
  readonly testType: TestType;
  analyze(input: AdapterInput): Promise<IsolationResult>;
  plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan>;
  generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult>;
  run(input: AdapterInput & { generation: GenerationResult }): Promise<TestRunResult>;
  review(input: AdapterInput & { generation: GenerationResult; run: TestRunResult }): Promise<ReviewSummary>;
}
