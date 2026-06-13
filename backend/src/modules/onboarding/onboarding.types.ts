export type TestStatus = 'passed' | 'failed' | 'flaky' | 'missing' | 'suspicious';
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
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type InsightAction =
  | 'Generate missing tests'
  | 'Review suspicious tests'
  | 'Explain failure'
  | 'Create refactor plan'
  | 'Open related test cases';

export interface UploadedFileInput {
  name: string;
  type: 'pdf' | 'md' | 'txt' | 'csv' | 'xlsx' | 'json';
  size: string;
  bytes?: number;
  snippet?: string;
}

export interface KnowledgeDocInput {
  id: string;
  file: UploadedFileInput;
  status: 'indexed' | 'indexing' | 'failed';
}

export interface QCTestCaseInput {
  id: string;
  feature: string;
  scenario: string;
  expectedResult: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  automationStatus: 'automated' | 'missing' | 'unknown';
}

export interface OnboardingDraftInput {
  productDocs?: KnowledgeDocInput[];
  docSources?: string[];
  qcFiles?: UploadedFileInput[];
  qcPreview?: QCTestCaseInput[];
}

export interface ScanLogEntry {
  at: string;
  level: 'info' | 'ok' | 'warn';
  message: string;
}

export interface ScanSummary {
  automatedTestsFound: number;
  qcCasesImported: number;
  productDocsIndexed: number;
  missingRecommended: number;
  suspiciousTests: number;
  failedTests: number;
  flakyTests: number;
  coverage: number;
}

export interface DashboardPayload {
  repo: { name: string; path: string; branch: string; commit?: string };
  lastScanAt: string;
  filesIndexed: number;
  health: {
    score: number;
    max: 100;
    grade: string;
    trend: { value: number; sentiment: 'good' | 'bad' | 'neutral'; basis?: string };
    note?: string;
  };
  metrics: Record<string, { value: number; isPercent?: boolean; trend?: { value: number; sentiment: 'good' | 'bad' | 'neutral'; basis?: string } }>;
  testCases: Array<{
    id: string;
    title: string;
    status: TestStatus;
    type: TestType;
    feature: string;
    risk: RiskLevel;
    lastRunAt: string | null;
    recentRuns: (0 | 1)[];
    description: string;
    aiNote?: { text: string; tone: 'warn' | 'info' };
  }>;
  insights: Array<{
    id: string;
    severity: Severity;
    title: string;
    description: string;
    action: InsightAction;
    relatedTestIds: string[];
    meta?: string;
  }>;
  structure: Array<{
    pathPrefix: string;
    name: string;
    coverage: number;
    counts: Array<{ label: string; count: number; kind: 'unit' | 'integration' | 'failed' | 'flaky' | 'missing' | 'suspicious' | 'other' }>;
  }>;
  coverage: Array<{ module: string; line: number; branch: number }>;
  riskHeatmap: {
    columns: ('Failed' | 'Flaky' | 'Missing' | 'Suspect')[];
    rows: Array<{ module: string; values: (0 | 1 | 2 | 3)[] }>;
  };
  activity: Array<{
    id: string;
    state: 'done' | 'active' | 'pending';
    title: string;
    at: string;
    detail?: string;
    awaitingApproval?: boolean;
  }>;
}

export interface OnboardingCommitResponse {
  jobId: string;
  summary: ScanSummary;
  logs: ScanLogEntry[];
  dashboard: DashboardPayload;
}

export interface ScanReasoningResult {
  summary?: Partial<Pick<ScanSummary, 'missingRecommended' | 'suspiciousTests' | 'failedTests' | 'flakyTests' | 'coverage'>>;
  insights?: Array<{
    severity?: Severity;
    title?: string;
    description?: string;
    action?: InsightAction;
    meta?: string;
  }>;
  testCases?: Array<{
    title?: string;
    status?: TestStatus;
    type?: TestType;
    feature?: string;
    risk?: RiskLevel;
    description?: string;
    aiNote?: string;
  }>;
}

export interface RepoScanFacts {
  filesIndexed: number;
  sourceFiles: string[];
  testFiles: string[];
  sourceSnippets: Array<{ path: string; content: string }>;
  testSnippets: Array<{ path: string; content: string }>;
  skippedLargeFiles: number;
  modules: Array<{ name: string; pathPrefix: string; sourceCount: number; testCount: number }>;
  detectedStack: string[];
  packageManager: 'npm' | 'pnpm' | 'yarn';
  commands: { test?: string; coverage?: string; typecheck?: string; lint?: string };
  installRun?: { command: string; ok: boolean; output: string };
  testRun?: { command: string; ok: boolean; output: string };
  coverageRun?: { command: string; ok: boolean; output: string; coverage?: number };
}
