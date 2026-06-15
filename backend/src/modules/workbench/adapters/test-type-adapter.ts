import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { StructuredModelRunner } from '../model/structured-model-runner.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';
import type { SkillContractLoader } from '../skills/skill-contract-loader.js';
import type {
  GenerationResult,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  RunOptions,
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
  emit: (event: AdapterEvent) => Promise<AdapterEvent>;
  modelConnect: ModelConnect | null;
  skills: SkillContractLoader;
  structuredModel: StructuredModelRunner;
  signal: AbortSignal;
}

export interface TestTypeAdapter {
  readonly testType: TestType;
  analyze(input: AdapterInput): Promise<IsolationResult>;
  plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan>;
  generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult>;
  run(input: AdapterInput & { generation: GenerationResult; runOptions?: RunOptions }): Promise<TestRunResult>;
  review(input: AdapterInput & { generation: GenerationResult; run: TestRunResult }): Promise<ReviewSummary>;
}
