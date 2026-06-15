// Importable mirror of the inter-team contract.
// Canonical source: frontend/design/testlens-schemas.ts (shared with backend / Data+AI teams).
// Keep in sync. App code imports types via "@/types/testlens" instead of reaching into design/.

/**
 * ============================================================================
 *  TestLens — Shared Data Schemas
 * ----------------------------------------------------------------------------
 *  Single source of truth for the three product surfaces:
 *    1. Dashboard            (TestLens Dashboard.html)
 *    2. Onboarding           (TestLens Onboarding.html)
 *    3. Generate/Improve     (TestLens Generate Tests.html)
 *
 *  These are the CONTRACTS between backend (the local agent / API) and the
 *  frontend. Frontend renders these shapes; backend produces them.
 *
 *  Conventions
 *  -----------
 *  - All timestamps are ISO-8601 UTC strings (e.g. "2026-06-11T14:32:08Z").
 *    The UI is responsible for "4 min ago" style formatting, never the API.
 *  - All coverage / percentage values are numbers 0..100 (not strings, not 0..1).
 *  - All ids are stable, opaque strings unless noted.
 *  - "Display only" fields are flagged; everything else is real data.
 * ============================================================================
 */

/* ============================================================================
 * 0. SHARED PRIMITIVES & ENUMS  (used across all three pages)
 * ========================================================================== */

/** Lifecycle status of a single automated test case. */
export type TestStatus =
  | 'passed'
  | 'failed'
  | 'flaky'
  | 'missing'      // recommended but does not exist yet
  | 'suspicious';  // exists & may pass, but contradicts the product spec

/** Category of a test. The first 7 map to the dashboard; the last 3 are
 *  first-class in the Generate/Improve workbench. Keep this list closed —
 *  add new members here so every surface stays in sync. */
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

/** Risk of the behavior under test. 'Critical' is only used in the workbench
 *  (S2 classification) where a finer grade is needed. */
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

/** Severity used for AI insights / recommendations (dashboard + workbench). */
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

/** Product feature / module the test belongs to. Free-form in principle, but
 *  the demo set is fixed; treat as an open string enum keyed by the repo. */
export type FeatureModule =
  | 'Checkout'
  | 'Coupon'
  | 'Payment'
  | 'User Session'
  | 'Order Summary'
  | (string & {});

/** Outcome of executing a single test in a run (superset of TestStatus for
 *  results tables — adds run-only outcomes). */
export type RunOutcome =
  | 'Passed'
  | 'Failed'
  | 'Flaky'
  | 'Skipped'
  | 'Needs approval';

/** Identifies the repository + branch a payload was computed against.
 *  Embedded in every top-level response so the UI can detect staleness. */
export interface RepoRef {
  /** Repo slug, e.g. "checkout-service". */
  name: string;
  /** Absolute local path, e.g. "/Users/dev/projects/checkout-service". */
  path: string;
  /** Current branch, e.g. "feature/coupon-refactor". */
  branch: string;
  /** Commit SHA the scan was run against (short or full). */
  commit?: string;
}

export interface AuthUser {
  id: string;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthMeResponse {
  user: AuthUser;
}

/** GitHub repository before Guardrail has cloned it locally. */
export interface GitHubRepoSummary {
  githubRepoId: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  repoId?: string;
  status?: string;
  isCloned?: boolean;
  clonePath?: string;
  currentBranch?: string;
  commitSha?: string;
  lastClonedAt?: string;
}

export interface ConnectedRepo {
  repoId: string;
  repo: RepoRef;
  reused?: boolean;
}

export interface RepoFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface RepoFileContent {
  path: string;
  content: string;
  size: number;
}

/** A delta vs. the previous scan. `direction` is semantic, not just sign:
 *  e.g. fewer failed tests is "good" even though the number went down. */
export interface Trend {
  /** Signed change. Unit depends on the metric (count, points, %). */
  value: number;
  /** Whether this movement is good or bad for the user. Drives color. */
  sentiment: 'good' | 'bad' | 'neutral';
  /** Optional human label, e.g. "vs last scan", "this week". */
  basis?: string;
}


/* ============================================================================
 * 1. DASHBOARD  (TestLens Dashboard.html)
 *    Read-only snapshot of repository testing health.
 * ========================================================================== */

export interface DashboardPayload {
  repo: RepoRef;
  /** When the scan that produced this payload completed. */
  lastScanAt: string;
  /** Files indexed in the last scan (display in the top bar). */
  filesIndexed: number;

  health: HealthScore;
  metrics: HealthMetrics;
  testCases: TestCase[];
  insights: Insight[];
  structure: StructureNode[];
  coverage: ModuleCoverage[];
  riskHeatmap: RiskHeatmap;
  activity: ActivityEvent[];
}

/** The 0–100 headline score + letter grade shown in the donut. */
export interface HealthScore {
  score: number;          // 0..100
  max: 100;
  grade: string;          // "A" | "B+" | "C+" ... derived server-side
  trend: Trend;           // e.g. { value: 6, sentiment: 'good', basis: 'this week' }
  /** One-line explanation of what drags the score down. */
  note?: string;
}

/** The 8 summary tiles. Each is a metric with an optional trend. */
export interface HealthMetrics {
  totalTests: MetricTile;
  passed: MetricTile;
  failed: MetricTile;
  flaky: MetricTile;
  missing: MetricTile;
  suspicious: MetricTile;
  /** Line coverage %, 0..100. */
  coverage: MetricTile;
  /** Count of High-risk tests not currently passing. */
  highRiskOpen: MetricTile;
}

export interface MetricTile {
  /** Numeric value, or percentage when `isPercent`. `null` means "not measured" (renders as "—"). */
  value: number | null;
  isPercent?: boolean;
  trend?: Trend;
}

/** A behavior-level test case (NOT source code). Core dashboard entity. */
export interface TestCase {
  id: string;
  title: string;
  status: TestStatus;
  type: TestType;
  feature: FeatureModule;
  risk: RiskLevel;            // Low | Medium | High (Critical not used here)
  /** ISO timestamp of last run, or null if never run (status === 'missing'). */
  lastRunAt: string | null;
  /** Outcome of the last N runs, newest last. 1 = pass, 0 = fail.
   *  Empty array when the test has never run. Drives the sparkbars. */
  recentRuns: (0 | 1)[];
  /** What the test validates, in product language. */
  description: string;
  /** Optional agent annotation (spec mismatch, flakiness, gap). */
  aiNote?: AINote;
}

export interface AINote {
  text: string;
  /** 'warn' renders amber (problem); 'info' renders indigo (observation). */
  tone: 'warn' | 'info';
}

/** A recommendation card in the AI Insights panel. */
export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  /** Suggested next action; maps to a button. */
  action: InsightAction;
  /** TestCase.id[] this insight relates to — clicking highlights them. */
  relatedTestIds: string[];
  /** Short meta line, e.g. "3 high-risk failures · Payment, Checkout". */
  meta?: string;
}

export type InsightAction =
  | 'Generate missing tests'
  | 'Review suspicious tests'
  | 'Explain failure'
  | 'Create refactor plan'
  | 'Open related test cases';

/** A row in the Testing Structure tree (one source dir / module). */
export interface StructureNode {
  /** Parent path prefix, e.g. "src/features/". */
  pathPrefix: string;
  /** Leaf name, e.g. "checkout". */
  name: string;
  /** Line coverage %, 0..100, or `null` when not measured per module. */
  coverage: number | null;
  /** Labeled counts shown as chips, e.g. { Unit: 12, Integration: 4, Missing: 3 }. */
  counts: StructureCount[];
}

export interface StructureCount {
  label: string;            // "Unit" | "Integration" | "Failed" | "Missing" | ...
  count: number;
  /** Semantic kind drives the chip color; keep aligned with TestStatus where possible. */
  kind: 'unit' | 'integration' | 'failed' | 'flaky' | 'missing' | 'suspicious' | 'other';
}

/** Per-module coverage for the bar chart. */
export interface ModuleCoverage {
  module: FeatureModule;
  line: number | null;      // 0..100, or null when not measured
  branch: number | null;    // 0..100, or null when not measured
}

/** Risk heatmap: modules (rows) × issue categories (columns). */
export interface RiskHeatmap {
  columns: ('Failed' | 'Flaky' | 'Missing' | 'Suspect')[];
  rows: RiskHeatmapRow[];
}
export interface RiskHeatmapRow {
  module: FeatureModule;
  /** Severity per column, same order as `columns`. 0 = none … 3 = severe. */
  values: (0 | 1 | 2 | 3)[];
}

/** An entry in the Agent Activity timeline. */
export interface ActivityEvent {
  id: string;
  state: 'done' | 'active' | 'pending';
  /** May contain a small amount of inline emphasis; keep HTML out of data —
   *  send plain text + optional `highlight` tokens if emphasis is needed. */
  title: string;
  at: string;               // ISO timestamp; UI formats
  detail?: string;          // secondary line, e.g. "2,418 files indexed"
  /** When true, the UI renders an approval affordance (e.g. "Approve & create files"). */
  awaitingApproval?: boolean;
}


/* ============================================================================
 * 2. ONBOARDING  (TestLens Onboarding.html)
 *    First-run wizard that collects the 4 knowledge sources + commands,
 *    then runs the initial scan. This is a STATEFUL flow: the client builds
 *    an OnboardingDraft and POSTs it; the server streams ScanProgress.
 * ========================================================================== */

export type OnboardingStepId =
  | 'repository'
  | 'product-knowledge'   // optional
  | 'qc-cases'            // optional
  | 'commands'
  | 'scan';

export type StepStatus = 'todo' | 'current' | 'done' | 'skipped';

/** The mutable client-side draft assembled across the wizard. */
export interface OnboardingDraft {
  repository: RepositorySelection;
  productDocs: KnowledgeDoc[];
  /** Free-form named sources, e.g. "Confluence Space: Checkout". */
  docSources: string[];
  qcFiles: UploadedFile[];
  qcPreview: QCTestCase[];
  commands: CommandConfig;
  scanOptions: ScanOptions;
  /** Per-step status for the left stepper. */
  steps: Record<OnboardingStepId, StepStatus>;
}

/** Step 1 — repository selection + auto-detected stack. */
export interface RepositorySelection {
  repo: RepoRef;
  /** Auto-detected languages/frameworks, e.g. ["TypeScript","React","Jest"]. */
  detectedStack: string[];
  /** Number of uncommitted changes in the working tree (0 = clean). */
  uncommittedChanges: number;
}

/** Step 2 — a product/spec document (optional, recommended). */
export interface KnowledgeDoc {
  id: string;
  file: UploadedFile;
  /** Indexing state once uploaded. */
  status: 'indexed' | 'indexing' | 'failed';
}

/** Generic uploaded-file descriptor (used by docs & QC). */
export interface UploadedFile {
  name: string;
  /** Lowercased extension without the dot. */
  type: 'pdf' | 'md' | 'txt' | 'csv' | 'xlsx' | 'json';
  /** Human-readable size, e.g. "1.4 MB". Raw bytes optional. */
  size: string;
  bytes?: number;
}

/** Step 3 — a single manual QC test case (imported & shown in preview). */
export interface QCTestCase {
  /** External QC id, e.g. "QC-102". */
  id: string;
  feature: FeatureModule;
  scenario: string;
  expectedResult: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  /** How this manual case maps to automation today. */
  automationStatus: 'automated' | 'missing' | 'unknown';
}

/** Step 4 — runnable commands, all editable by the user. */
export interface CommandConfig {
  packageManager: 'npm' | 'pnpm' | 'yarn';
  test: string;             // e.g. "npm test"
  relatedTest: string;      // e.g. "npm test -- --runInBand"
  coverage: string;         // e.g. "npm run test:coverage"
  typecheck?: string;       // optional
  lint?: string;            // optional
}

/** Step 4 — initial-scan toggles. */
export interface ScanOptions {
  runFullSuite: boolean;
  runCoverage: boolean;
  runTypecheck: boolean;
  runLint: boolean;
  detectFlakyByRerun: boolean;
  /** If true the agent may draft test files after the scan (staged, not applied). */
  allowTestGeneration: boolean;
}

/* ---- Step 5 — initial scan execution (server → client, streamed) ---------- */

export type ScanTaskId =
  | 'analyze-structure' | 'detect-framework' | 'discover-tests'
  | 'parse-docs' | 'import-qc' | 'map-files'
  | 'run-tests' | 'run-coverage' | 'detect-missing'
  | 'detect-suspicious' | 'generate-insights';

export interface ScanTask {
  id: ScanTaskId;
  label: string;
  status: 'pending' | 'running' | 'done' | 'warning';
}

/** Streamed log line during the scan. */
export interface ScanLogEntry {
  at: string;                       // ISO timestamp
  level: 'info' | 'ok' | 'warn';
  message: string;
}

/** Streamed progress envelope (e.g. over SSE/WebSocket). */
export interface ScanProgress {
  /** 0..100 overall. */
  percent: number;
  currentTaskId: ScanTaskId | null;
  tasks: ScanTask[];
  /** Append-only; client renders newest at bottom. */
  log: ScanLogEntry[];
  done: boolean;
}

/** Final success summary (the 8 result cards). On completion this becomes
 *  the seed for the Dashboard's HealthMetrics. */
export interface ScanSummary {
  automatedTestsFound: number;
  qcCasesImported: number;
  productDocsIndexed: number;
  missingRecommended: number;
  suspiciousTests: number;
  failedTests: number;
  flakyTests: number;
  /** Line coverage %, 0..100. */
  coverage: number;
}


/* ============================================================================
 * 3. GENERATE / IMPROVE WORKBENCH  (TestLens Generate Tests.html)
 *    A 6-step, human-approved workflow. Modeled as a single Session whose
 *    sub-objects are filled in as the user advances. Each transition is an
 *    explicit, approvable action — nothing mutates the repo without approval.
 * ========================================================================== */

export type WorkflowStepId =
  | 'intent' | 'isolation' | 'plan' | 'generate' | 'run' | 'review';

export type WorkflowStepStatus = 'locked' | 'active' | 'done' | 'warn';

/** Top-level container for an Improve-Tests workflow. */
export interface WorkbenchSession {
  id: string;
  repo: RepoRef;
  createdAt: string;
  steps: Record<WorkflowStepId, WorkflowStepStatus>;

  intent: IntentInput;
  isolation?: IsolationResult;     // filled after "Analyze"
  plan?: TestPlan;                 // filled after "Generate Plan"
  generation?: GenerationResult;   // filled after "Approve Plan"
  run?: TestRunResult;             // filled after "Run Tests"
  review?: ReviewSummary;          // computed for the final step
}

/* ---- S1. Intent ----------------------------------------------------------- */

export interface IntentInput {
  /** Natural-language goal, e.g. "Improve tests for the coupon feature…". */
  prompt: string;
  feature: FeatureModule | null;
  /** Test types to consider (chips). */
  testTypes: TestType[];
  /** Knowledge sources the agent may use. */
  sources: SourceContext[];
}

export type SourceContext =
  | 'Codebase'
  | 'Product specs / wiki'
  | 'QC test cases'
  | 'Existing automated tests'
  | 'Coverage report'
  | 'Previous failed runs';

/** A canned starting point surfaced from a dashboard Insight. */
export interface QuickAction {
  id: string;
  label: string;                   // "Generate 4 missing coupon edge-case tests"
  feature: FeatureModule;
  severity: Severity;
  /** Pre-selects these test types when chosen. */
  testTypes: TestType[];
  /** The Insight.id this was derived from (round-trips back to the dashboard). */
  sourceInsightId?: string;
}

/* ---- S2. Isolation & Classification --------------------------------------- */

export interface IsolationResult {
  target: { feature: FeatureModule; repo: RepoRef };
  sourceFiles: RelatedFile[];
  existingTestFiles: RelatedFile[];
  specDocs: RelatedFile[];         // product specs / wiki
  qcCases: QCTestCase[];           // related manual cases (reuses §2 type)
  currentCoverage: { line: number; branch: number };
  currentStatus: { failed: number; suspicious: number; missing: number; flaky?: number };
  /** Detected user journeys, plain strings. */
  userJourneys: string[];
  classifications: BehaviorClassification[];
}

export interface RelatedFile {
  path: string;
  kind: 'source' | 'test' | 'spec' | 'qc';
  /** Small meta, e.g. "412 LOC", "6 tests", "product spec". */
  meta?: string;
}

/** One classified behavior in the coverage map. */
export interface BehaviorClassification {
  behavior: string;                // "Expired coupon"
  status: 'Covered' | 'Missing' | 'Weak' | 'Failed' | 'Suspicious';
  /** Recommended test type(s) to address it. */
  suggestedTypes: TestType[];
  risk: RiskLevel;                 // Low..Critical
  explanation: string;
}

/* ---- S3. Confirmation / Plan ---------------------------------------------- */

export interface TestPlan {
  proposedActions: PlanAction[];
  risk: PlanRiskAssessment;
  /** Files the agent expects to add/modify (proposal only). */
  filesToChange: string[];
  questions: AIQuestion[];
  runConstraints?: BehaviorRunConstraints[];
}

export interface PlanAction {
  action: 'add' | 'update' | 'delete' | 'run';
  label: string;                   // "Add unit tests"
  /** Number of items, or null for run/coverage actions. */
  count: number | null;
  /** Behavior titles covered by this action group. */
  items?: string[];
}

export interface BehaviorRunConstraints {
  behavior: string;
  maxStepDurationMs: number;
  maxSteps: number;
  reason?: string;
}

/** Explicit pre-flight risk disclosure shown before any file is written. */
export interface PlanRiskAssessment {
  productionCodeChanges: 'none' | 'expected';
  testDataChanges: boolean;
  browserAutomationRequired: boolean;
  mobileSimulatorRequired: 'required' | 'optional' | 'no';
  externalApiMocking: 'required' | 'optional' | 'no';
}

/** A clarification question the user answers inline before generation. */
export interface AIQuestion {
  id: string;
  question: string;
  /** Selectable options; first is typically the spec-recommended choice. */
  options: string[];
  /** Index into `options`; undefined until answered. */
  answerIndex?: number;
}

/** The set of decisions the user makes leaving S3. */
export interface PlanApproval {
  decision: 'approve' | 'edit' | 'cancel';
  /** Scope narrowing toggles from the approval bar. */
  skipUiTests?: boolean;
  unitTestsOnly?: boolean;
  /** Answers collected from AIQuestion[]. Keyed by AIQuestion.id. */
  answers: Record<string, number>;
}

/* ---- S4. Generate (Add / Update / Delete) --------------------------------- */

export interface GenerationResult {
  /** Live agent activity steps (S4 left rail). */
  timeline: GenerationStep[];
  changes: GeneratedChange[];
  /** Narrative before/after bullets (display only). */
  beforeAfter: { before: string[]; after: string[] };
}

export interface GenerationStep {
  label: string;                   // "Reading product spec — Coupon Rules.md"
  status: 'pending' | 'running' | 'done';
}

/** A single proposed change to the test suite. Never auto-applied. */
export interface GeneratedChange {
  id: string;
  action: 'Add' | 'Update' | 'Delete';
  testType: TestType;
  title: string;                   // the test case name, product-language
  file: string;                    // target path
  feature: FeatureModule;
  risk: RiskLevel;
  /** Why the agent proposes this; may reference a QC id or spec. */
  reason: string;
  /** Mock/real unified-diff preview. */
  diff: DiffLine[];
  status: 'staged' | 'applied' | 'reverted';
}

export interface DiffLine {
  kind: 'add' | 'del' | 'context' | 'meta';
  text: string;
}

/* ---- S5. Run Tests -------------------------------------------------------- */

export interface TestRunResult {
  unit: UnitRunResult;
  ui: UIRunResult;
  mobile: MobileRunResult;
  coverage: CoverageDelta[];
  matrix: TestResultRow[];
  /** Present when a test failed or is flaky and needs a decision. */
  attention?: FailureCard;
}

export interface UnitRunResult {
  command: string;                 // "npm test -- coupon.test.ts"
  outcome: RunOutcome;
  passed: number;
  failed?: number;
  durationMs: number;
  suite: string;
}

export interface UIRunResult {
  command: string;                 // "npx playwright test checkout-coupon.spec.ts"
  browser: string;                 // "Chromium"
  outcome: RunOutcome;
  passed: number;
  durationMs: number;
  /** Visual comparison result vs. approved baseline. */
  visual?: { matchPercent: number; baseline: string };
  evidence: Evidence[];
}

export interface MobileRunResult {
  command: string;                 // "npm run test:mobile -- login-retry"
  devices: string[];               // ["iPhone 15","Pixel 7"]
  /** Throttled network profile used, if any. */
  network?: string;                // "Slow 3G (throttled)"
  outcome: RunOutcome;
  passed: number;
  flaky?: number;
  durationMs: number;
  evidence: Evidence[];
}

/** A captured artifact for a UI/mobile test. */
export interface Evidence {
  kind: 'screenshot' | 'video' | 'trace' | 'device-log' | 'visual-diff';
  label: string;
  /** URI/handle to the artifact (local file path or signed URL). */
  href?: string;
}

/** Coverage before → after for one metric. */
export interface CoverageDelta {
  metric: 'Line coverage' | 'Branch coverage' | 'Function coverage' | 'Changed-files';
  before: number;                  // 0..100
  after: number;                   // 0..100
}

/** A row in the run result matrix. */
export interface TestResultRow {
  title: string;
  type: TestType;
  status: RunOutcome;
  /** Human duration ("38ms", "1.8s") or null when not run. */
  duration: string | null;
  /** Evidence summary string, or null. */
  evidence: string | null;
  /** Clickable artifacts captured for this test row. */
  evidenceItems?: Evidence[];
  /** Why the test failed or was flaky; null when passed/skipped. */
  reason: string | null;
  file: string;
}

/** Shown when a generated test fails or is flaky. Drives the 3 action buttons. */
export interface FailureCard {
  testTitle: string;
  /** 'flaky' renders amber, 'failed' renders red. */
  kind: 'failed' | 'flaky';
  reason: string;
  likelyCause: string;
  suggestedFix: string;
  /** Available resolutions. */
  actions: ('ask-agent-to-fix' | 'accept-and-keep' | 'revert-generated-test')[];
}

/* ---- S6. Review & Apply --------------------------------------------------- */

export interface ReviewSummary {
  testsAdded: number;
  testsUpdated: number;
  testsDeleted: number;
  /** e.g. "10/11". */
  testsPassing: string;
  coverage: { lineDelta: number; branchDelta: number };
  flakyTracked: number;
  filesChanged: ChangedFile[];
  remainingRisk: RiskRow[];
  openQuestions: number;
  recommendation: string;          // display only
}

export interface ChangedFile {
  path: string;
  /** "new" | "+38 −6" | "+41" — display diff stat. */
  diffStat: string;
  changeKind: 'add' | 'update' | 'delete';
}

export interface RiskRow {
  label: string;
  value: string;
  sentiment: 'good' | 'bad' | 'neutral';
}

/** Terminal decision a user can take in S6. Each is an explicit user action. */
export type ReviewDecision =
  | { type: 'apply' }              // write staged changes to working tree
  | { type: 'create-pr' }          // push branch + open PR
  | { type: 'export-plan' }        // export markdown test plan
  | { type: 'revert-all' };        // discard all staged changes


/* ============================================================================
 * 4. SUGGESTED API SURFACE  (how the three pages map to endpoints)
 * ----------------------------------------------------------------------------
 *  Reference shapes so frontend & backend teams can build in parallel.
 *  All paths are scoped to a repo: /api/repos/:repoId/...
 * ========================================================================== */

export interface TestLensApi {
  /* Auth + repo access */
  // GET  /api/auth/github                  -> GitHub OAuth redirect
  // GET  /api/auth/github/callback         -> sets gr_session cookie, redirects /onboarding
  // GET  /api/auth/me                      -> AuthMeResponse
  // POST /api/auth/logout                  -> { ok: true }
  // GET  /api/repos                        -> GitHubRepoSummary[]
  // POST /api/repos/:githubRepoId/connect  -> ConnectedRepo
  // GET  /api/repos/:repoId/files?path     -> { nodes: RepoFileNode[] }
  // GET  /api/repos/:repoId/file?path      -> RepoFileContent

  /* Dashboard */
  // GET  /dashboard                  -> DashboardPayload
  // POST /scan                       -> { jobId } ; then stream ScanProgress
  // GET  /tests?status&type&risk&feature&q  -> TestCase[]   (server-side filterable)

  /* Onboarding */
  // GET  /onboarding/detect          -> RepositorySelection (auto-detect stack)
  // POST /onboarding/docs            -> KnowledgeDoc          (upload)
  // POST /onboarding/qc              -> { files: UploadedFile[]; preview: QCTestCase[] }
  // POST /onboarding/commit          -> { jobId }   (body: OnboardingDraft) ; stream ScanProgress
  // GET  /onboarding/result          -> ScanSummary

  /* Generate / Improve workbench */
  // POST /workbench/sessions                 -> WorkbenchSession   (body: IntentInput)
  // POST /workbench/:id/analyze              -> IsolationResult
  // POST /workbench/:id/plan                 -> TestPlan
  // POST /workbench/:id/approve              -> GenerationResult   (body: PlanApproval) ; stream timeline
  // POST /workbench/:id/run                  -> TestRunResult       ; stream per-suite progress
  // GET  /workbench/:id/review               -> ReviewSummary
  // POST /workbench/:id/decision             -> { ok: true }        (body: ReviewDecision)
}
