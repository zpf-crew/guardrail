export interface RepoInfo {
  name: string;
  branch: string;
  language: string;
  framework: string;
  fileCount: number;
}

export interface DocFile {
  name: string;
  type: string;
  size: string;
}

export interface QCRow {
  id: string;
  feature: string;
  scenario: string;
  expected: string;
  priority: string;
  automated: string;
}

export interface ScanTask {
  label: string;
}

export const repoInfo: RepoInfo = {
  name: 'checkout-service',
  branch: 'feature/coupon-refactor',
  language: 'TypeScript',
  framework: 'Express',
  fileCount: 2418,
};

export const mockDocs: DocFile[] = [
  { name: 'Checkout Flow Spec.pdf', type: 'pdf', size: '2.4 MB' },
  { name: 'Coupon Rules.md', type: 'md', size: '18 KB' },
  { name: 'Payment Gateway API.txt', type: 'txt', size: '12 KB' },
];

export const mockQCs: DocFile[] = [
  { name: 'qc-checkout-suite.csv', type: 'csv', size: '34 KB' },
  { name: 'qc-payment-cases.xlsx', type: 'xlsx', size: '56 KB' },
];

export const qcRows: QCRow[] = [
  { id: 'QC-001', feature: 'Checkout', scenario: 'Apply valid coupon', expected: 'Discount applied, total updated', priority: 'High', automated: 'Yes' },
  { id: 'QC-002', feature: 'Checkout', scenario: 'Apply expired coupon', expected: 'Error: coupon expired', priority: 'High', automated: 'Yes' },
  { id: 'QC-003', feature: 'Payment', scenario: 'Card payment success', expected: 'Order confirmed, receipt sent', priority: 'Critical', automated: 'Yes' },
  { id: 'QC-004', feature: 'Payment', scenario: 'Card payment declined', expected: 'Error shown, retry option', priority: 'Critical', automated: 'No' },
  { id: 'QC-005', feature: 'Checkout', scenario: 'Empty cart checkout', expected: 'Blocked with message', priority: 'Medium', automated: 'Yes' },
  { id: 'QC-006', feature: 'Coupon', scenario: 'Stack multiple coupons', expected: 'Only one allowed', priority: 'Medium', automated: 'No' },
  { id: 'QC-007', feature: 'Payment', scenario: 'Partial refund', expected: 'Refund processed, balance updated', priority: 'High', automated: 'No' },
  { id: 'QC-008', feature: 'Checkout', scenario: 'Guest checkout', expected: 'Order created without account', priority: 'High', automated: 'Yes' },
];

export const scanTasks: ScanTask[] = [
  { label: 'Analyzing repository structure' },
  { label: 'Detecting framework and dependencies' },
  { label: 'Discovering existing test files' },
  { label: 'Parsing product documentation' },
  { label: 'Importing QC test cases' },
  { label: 'Mapping file-to-feature relationships' },
  { label: 'Running existing test suite' },
  { label: 'Collecting coverage data' },
  { label: 'Detecting missing test coverage' },
  { label: 'Detecting suspicious tests' },
  { label: 'Analyzing test flakiness' },
  { label: 'Generating insights and recommendations' },
];

export const scanLogs: string[] = [
  '[00:01] Scanning repository: checkout-service...',
  '[00:02] Found 2,418 files across 142 directories',
  '[00:03] Detected framework: Express (Node.js)',
  '[00:05] Found 847 test files (unit: 623, integration: 142, e2e: 82)',
  '[00:07] Parsed 3 product documents',
  '[00:08] Imported 8 QC test cases',
  '[00:10] Mapped 24 source files to features',
  '[00:12] Running test suite...',
  '[00:18] Collected coverage: 64% line, 52% branch',
  '[00:20] Found 4 missing test scenarios',
  '[00:21] Found 2 suspicious tests conflicting with specs',
  '[00:22] Found 1 flaky test',
  '[00:24] Generated 6 AI insights',
  '[00:25] Scan complete.',
];

export const summaryStats = [
  { label: 'Tests found', value: '847', icon: '📋' },
  { label: 'QC imported', value: '8', icon: '📥' },
  { label: 'Docs indexed', value: '3', icon: '📄' },
  { label: 'Missing', value: '4', icon: '⚠️' },
  { label: 'Suspicious', value: '2', icon: '🔍' },
  { label: 'Failed', value: '12', icon: '❌' },
  { label: 'Flaky', value: '1', icon: '⚡' },
  { label: 'Coverage', value: '64%', icon: '📊' },
];
