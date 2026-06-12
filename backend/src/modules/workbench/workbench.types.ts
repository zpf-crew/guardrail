// Backend mirror of the shared TestLens workbench schema.
// Canonical source: frontend/design/testlens-schemas.ts.
// Keep enum strings and field names identical so backend fallback payloads can
// be consumed by the existing frontend pages without translation.

export type TestType =
  | 'Unit'
  | 'Integration'
  | 'E2E'
  | 'Contract'
  | 'Regression'
  | 'Edge Case'
  | 'Security'
  | 'UI / Browser'
  | 'Visual Screenshot'
  | 'Mobile';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type FeatureModule =
  | 'Checkout'
  | 'Coupon'
  | 'Payment'
  | 'User Session'
  | 'Order Summary'
  | (string & {});

export type RunOutcome =
  | 'Passed'
  | 'Failed'
  | 'Flaky'
  | 'Skipped'
  | 'Needs approval';

export interface RepoRef {
  name: string;
  path: string;
  branch: string;
  commit?: string;
}

export interface QCTestCase {
  id: string;
  feature: FeatureModule;
  scenario: string;
  expectedResult: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  automationStatus: 'automated' | 'missing' | 'unknown';
}

export type WorkflowStepId =
  | 'intent' | 'isolation' | 'plan' | 'generate' | 'run' | 'review';

export type WorkflowStepStatus = 'locked' | 'active' | 'done' | 'warn';

export interface WorkbenchSession {
  id: string;
  repo: RepoRef;
  createdAt: string;
  steps: Record<WorkflowStepId, WorkflowStepStatus>;

  intent: IntentInput;
  isolation?: IsolationResult;
  plan?: TestPlan;
  generation?: GenerationResult;
  run?: TestRunResult;
  review?: ReviewSummary;
}

export interface IntentInput {
  prompt: string;
  feature: FeatureModule | null;
  testTypes: TestType[];
  sources: SourceContext[];
}

export type SourceContext =
  | 'Codebase'
  | 'Product specs / wiki'
  | 'QC test cases'
  | 'Existing automated tests'
  | 'Coverage report'
  | 'Previous failed runs';

export interface IsolationResult {
  target: { feature: FeatureModule; repo: RepoRef };
  sourceFiles: RelatedFile[];
  existingTestFiles: RelatedFile[];
  specDocs: RelatedFile[];
  qcCases: QCTestCase[];
  currentCoverage: { line: number; branch: number };
  currentStatus: { failed: number; suspicious: number; missing: number; flaky?: number };
  userJourneys: string[];
  classifications: BehaviorClassification[];
}

export interface RelatedFile {
  path: string;
  kind: 'source' | 'test' | 'spec' | 'qc';
  meta?: string;
}

export interface BehaviorClassification {
  behavior: string;
  status: 'Covered' | 'Missing' | 'Weak' | 'Failed' | 'Suspicious';
  suggestedTypes: TestType[];
  risk: RiskLevel;
  explanation: string;
}

export interface TestPlan {
  proposedActions: PlanAction[];
  risk: PlanRiskAssessment;
  filesToChange: string[];
  questions: AIQuestion[];
}

export interface PlanAction {
  action: 'add' | 'update' | 'delete' | 'run';
  label: string;
  count: number | null;
}

export interface PlanRiskAssessment {
  productionCodeChanges: 'none' | 'expected';
  testDataChanges: boolean;
  browserAutomationRequired: boolean;
  mobileSimulatorRequired: 'required' | 'optional' | 'no';
  externalApiMocking: 'required' | 'optional' | 'no';
}

export interface AIQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex?: number;
}

export interface PlanApproval {
  decision: 'approve' | 'edit' | 'cancel';
  skipUiTests?: boolean;
  unitTestsOnly?: boolean;
  answers: Record<string, number>;
}

export interface GenerationResult {
  timeline: GenerationStep[];
  changes: GeneratedChange[];
  beforeAfter: { before: string[]; after: string[] };
}

export interface GenerationStep {
  label: string;
  status: 'pending' | 'running' | 'done';
}

export interface GeneratedChange {
  id: string;
  action: 'Add' | 'Update' | 'Delete';
  testType: TestType;
  title: string;
  file: string;
  feature: FeatureModule;
  risk: RiskLevel;
  reason: string;
  diff: DiffLine[];
  status: 'staged' | 'applied' | 'reverted';
}

export interface DiffLine {
  kind: 'add' | 'del' | 'context' | 'meta';
  text: string;
}

export interface TestRunResult {
  unit: UnitRunResult;
  ui: UIRunResult;
  mobile: MobileRunResult;
  coverage: CoverageDelta[];
  matrix: TestResultRow[];
  attention?: FailureCard;
}

export interface UnitRunResult {
  command: string;
  outcome: RunOutcome;
  passed: number;
  failed?: number;
  durationMs: number;
  suite: string;
}

export interface UIRunResult {
  command: string;
  browser: string;
  outcome: RunOutcome;
  passed: number;
  durationMs: number;
  visual?: { matchPercent: number; baseline: string };
  evidence: Evidence[];
}

export interface MobileRunResult {
  command: string;
  devices: string[];
  network?: string;
  outcome: RunOutcome;
  passed: number;
  flaky?: number;
  durationMs: number;
  evidence: Evidence[];
}

export interface Evidence {
  kind: 'screenshot' | 'video' | 'trace' | 'device-log' | 'visual-diff';
  label: string;
  href?: string;
}

export interface CoverageDelta {
  metric: 'Line coverage' | 'Branch coverage' | 'Function coverage' | 'Changed-files';
  before: number;
  after: number;
}

export interface TestResultRow {
  title: string;
  type: TestType;
  status: RunOutcome;
  duration: string | null;
  evidence: string | null;
  file: string;
}

export interface FailureCard {
  testTitle: string;
  kind: 'failed' | 'flaky';
  reason: string;
  likelyCause: string;
  suggestedFix: string;
  actions: ('ask-agent-to-fix' | 'accept-and-keep' | 'revert-generated-test')[];
}

export interface ReviewSummary {
  testsAdded: number;
  testsUpdated: number;
  testsDeleted: number;
  testsPassing: string;
  coverage: { lineDelta: number; branchDelta: number };
  flakyTracked: number;
  filesChanged: ChangedFile[];
  remainingRisk: RiskRow[];
  openQuestions: number;
  recommendation: string;
}

export interface ChangedFile {
  path: string;
  diffStat: string;
  changeKind: 'add' | 'update' | 'delete';
}

export interface RiskRow {
  label: string;
  value: string;
  sentiment: 'good' | 'bad' | 'neutral';
}

export type WorkbenchJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout';

export interface WorkbenchJob {
  id: string;
  sessionId: string;
  step: WorkflowStepId;
  status: WorkbenchJobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export type WorkbenchStepResult = IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary;

export type WorkbenchJobEvent =
  | { type: 'status'; jobId: string; step: WorkflowStepId; status: WorkbenchJobStatus }
  | { type: 'progress'; jobId: string; step: WorkflowStepId; percent?: number; message: string }
  | { type: 'thinking'; jobId: string; step: WorkflowStepId; message: string }
  | { type: 'artifact'; jobId: string; step: WorkflowStepId; artifact: Evidence }
  | { type: 'screenshot'; jobId: string; step: 'run'; artifact: Evidence }
  | { type: 'result'; jobId: string; step: WorkflowStepId; payload: WorkbenchStepResult }
  | { type: 'error'; jobId: string; step: WorkflowStepId; message: string; retryable: boolean };
