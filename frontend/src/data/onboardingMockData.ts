export interface GitHubRepo {
  org: string;
  name: string;
  fullName: string;
  branch: string;
  private: boolean;
}

export interface RepoInfo {
  name: string;
  fullName: string;
  branch: string;
  language: string;
  framework: string;
  fileCount: number;
}

export interface DocFile {
  name: string;
  type: 'pdf' | 'md' | 'txt' | 'csv' | 'xlsx' | 'json';
  size: string;
}

export interface QCRow {
  id: string;
  feature: string;
  scenario: string;
  expected: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  automated: 'automated' | 'missing' | 'unknown';
}

export interface ScanTask {
  label: string;
  warn?: boolean;
}

export interface ScanLogEntry {
  tag: 'ok' | 'warn' | 'info';
  message: string;
}

export interface SummaryStat {
  label: string;
  value: string;
  color: string;
}

export const githubRepos: GitHubRepo[] = [
  { org: 'acme-corp', name: 'checkout-service', fullName: 'acme-corp/checkout-service', branch: 'feature/coupon-refactor', private: true },
  { org: 'acme-corp', name: 'payment-gateway', fullName: 'acme-corp/payment-gateway', branch: 'main', private: true },
  { org: 'acme-corp', name: 'mobile-checkout', fullName: 'acme-corp/mobile-checkout', branch: 'develop', private: false },
];

export const repoInfo: RepoInfo = {
  name: 'checkout-service',
  fullName: 'acme-corp/checkout-service',
  branch: 'feature/coupon-refactor',
  language: 'TypeScript',
  framework: 'Express',
  fileCount: 2418,
};

export const mockDocs: DocFile[] = [
  { name: 'Checkout Flow Spec.pdf', type: 'pdf', size: '1.4 MB' },
  { name: 'Coupon Rules.md', type: 'md', size: '22 KB' },
  { name: 'Payment Error Handling.md', type: 'md', size: '18 KB' },
];

export const extraDocs: DocFile[] = [
  { name: 'Order Summary PRD.pdf', type: 'pdf', size: '880 KB' },
  { name: 'API Spec — Payments v2.txt', type: 'txt', size: '41 KB' },
  { name: 'Session & Auth Notes.md', type: 'md', size: '15 KB' },
];

export const defaultDocSources = ['Confluence Space: Checkout', 'Spec folder: /docs/product'];

export const mockQCs: DocFile[] = [
  { name: 'qc-checkout-suite.csv', type: 'csv', size: '86 KB' },
];

export const extraQCs: DocFile[] = [
  { name: 'payment-edge-cases.json', type: 'json', size: '12 KB' },
  { name: 'regression-checklist.md', type: 'md', size: '9 KB' },
];

export const qcRows: QCRow[] = [
  { id: 'QC-101', feature: 'Coupon', scenario: 'Apply valid coupon', expected: 'Discount is applied', priority: 'high', automated: 'automated' },
  { id: 'QC-102', feature: 'Coupon', scenario: 'Expired coupon', expected: 'Shows expired coupon error', priority: 'high', automated: 'missing' },
  { id: 'QC-118', feature: 'Coupon', scenario: 'Stacking blocked', expected: 'Second coupon rejected', priority: 'medium', automated: 'missing' },
  { id: 'QC-205', feature: 'Payment', scenario: 'API timeout', expected: 'User can retry payment', priority: 'critical', automated: 'missing' },
  { id: 'QC-211', feature: 'Payment', scenario: 'Declined card', expected: 'Retry prompt shown 3×', priority: 'critical', automated: 'automated' },
  { id: 'QC-301', feature: 'Checkout', scenario: 'Duplicate submit', expected: 'Prevents double order', priority: 'critical', automated: 'unknown' },
  { id: 'QC-307', feature: 'Checkout', scenario: 'Incomplete address', expected: 'Inline validation error', priority: 'high', automated: 'automated' },
  { id: 'QC-402', feature: 'Order Summary', scenario: 'Multi-currency total', expected: "Banker's rounding applied", priority: 'medium', automated: 'unknown' },
];

export const scanTasks: ScanTask[] = [
  { label: 'Analyze repository structure' },
  { label: 'Detect test framework & commands' },
  { label: 'Discover existing test cases' },
  { label: 'Parse product / wiki documents' },
  { label: 'Import QC test cases' },
  { label: 'Map source files to test files' },
  { label: 'Run test command' },
  { label: 'Run coverage command' },
  { label: 'Detect missing tests', warn: true },
  { label: 'Detect suspicious tests', warn: true },
  { label: 'Generate initial testing insights' },
];

export const scanLogs: ScanLogEntry[] = [
  { tag: 'info', message: 'Analyzing repository structure — 2,418 files across 6 feature modules' },
  { tag: 'ok', message: 'Detected Jest and React Testing Library' },
  { tag: 'ok', message: 'Found 186 automated test cases' },
  { tag: 'ok', message: 'Parsed 8 product documents (Checkout, Coupon, Payment, Session)' },
  { tag: 'ok', message: 'Imported 42 QC test cases' },
  { tag: 'ok', message: 'Mapped 31 QC scenarios to existing automated tests' },
  { tag: 'info', message: 'Running test suite — npm test -- --runInBand' },
  { tag: 'warn', message: '5 tests failed, 2 flaky across re-runs' },
  { tag: 'info', message: 'Coverage report parsed: 74% line coverage, 46% branch coverage' },
  { tag: 'warn', message: 'Found 9 missing high-priority test cases' },
  { tag: 'warn', message: 'Detected 3 suspicious tests inconsistent with product specs' },
  { tag: 'ok', message: 'Generated initial testing insights — dashboard is ready' },
];

export const summaryStats: SummaryStat[] = [
  { label: 'Automated tests found', value: '186', color: '#818cf8' },
  { label: 'QC test cases imported', value: '42', color: '#22d3ee' },
  { label: 'Product docs indexed', value: '8', color: '#60a5fa' },
  { label: 'Missing recommended', value: '9', color: '#60a5fa' },
  { label: 'Suspicious tests', value: '3', color: '#c084fc' },
  { label: 'Failed tests', value: '5', color: '#fb7185' },
  { label: 'Flaky tests', value: '2', color: '#fbbf24' },
  { label: 'Line coverage', value: '74%', color: '#3ddc97' },
];
