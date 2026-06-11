export interface TestCase {
  id: string;
  title: string;
  status: 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect';
  type: 'Unit' | 'Integration' | 'UI/Browser' | 'Mobile';
  feature: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
  aiNote?: string;
  noteType?: '' | 'warn';
  duration: string;
  lastRun: string;
  runs: number[];
}

export interface Insight {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  relatedTests: string[];
}

export interface Module {
  path: string;
  name: string;
  coverage: number;
  branchCoverage: number;
  tests: { unit: number; integration: number; e2e: number };
}

export interface HeatmapCell {
  module: string;
  missing: number;
  suspicious: number;
  flaky: number;
  failed: number;
}

export const healthScore = { score: 72, grade: 'C+', trend: '+3 from last week', note: 'Improving — suspicious tests fixed' };

export interface StatTile {
  label: string;
  value: string | number;
  color: string;
  delta: string;
  deltaCls: 'up' | 'down' | 'up-bad' | 'down-good';
  sub?: boolean;
}

export const statTiles: StatTile[] = [
  { label: 'Total test cases', value: 24, color: 'var(--accent)', delta: '+5', deltaCls: 'up' },
  { label: 'Passed', value: 14, color: 'var(--pass)', delta: '+4', deltaCls: 'up' },
  { label: 'Failed', value: 3, color: 'var(--fail)', delta: '-3', deltaCls: 'down-good' },
  { label: 'Flaky', value: 2, color: 'var(--flaky)', delta: '+1', deltaCls: 'up-bad' },
  { label: 'Missing', value: 4, color: 'var(--missing)', delta: '+5', deltaCls: 'up-bad' },
  { label: 'Suspicious', value: 2, color: 'var(--suspect)', delta: '+1', deltaCls: 'up-bad' },
  { label: 'Coverage', value: '71.4%', color: 'var(--accent-2)', delta: '+4.2%', deltaCls: 'up', sub: true },
  { label: 'High-risk open', value: 5, color: 'var(--fail)', delta: '-2', deltaCls: 'down-good' },
];

export const testCases: TestCase[] = [
  { id: 'T-001', title: 'Apply valid coupon at checkout', status: 'pass', type: 'Unit', feature: 'Coupon', risk: 'high', description: 'Tests that a valid coupon code applies the correct discount', aiNote: 'Well-covered, 5 assertions', duration: '42ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-002', title: 'Reject expired coupon', status: 'pass', type: 'Unit', feature: 'Coupon', risk: 'high', description: 'Tests that expired coupons are rejected with proper error', duration: '38ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-003', title: 'Stack multiple coupons', status: 'fail', type: 'Integration', feature: 'Coupon', risk: 'high', description: 'Tests that only one coupon can be applied at a time', aiNote: 'Fails: allows stacking after refactor', duration: '234ms', lastRun: '5 min ago', runs: [1,1,0,1,1] },
  { id: 'T-004', title: 'Guest checkout flow', status: 'pass', type: 'UI/Browser', feature: 'Checkout', risk: 'high', description: 'End-to-end guest checkout with payment', duration: '4.2s', lastRun: '10 min ago', runs: [1,1,1,1,1] },
  { id: 'T-005', title: 'Card payment success', status: 'pass', type: 'Integration', feature: 'Payment', risk: 'high', description: 'Tests successful card payment processing', duration: '156ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-006', title: 'Card payment declined', status: 'flaky', type: 'Integration', feature: 'Payment', risk: 'high', description: 'Tests declined card handling', aiNote: 'Flaky: timing issue with mock server', noteType: 'warn', duration: '312ms', lastRun: '8 min ago', runs: [1,0,1,0,0] },
  { id: 'T-007', title: 'Partial refund processing', status: 'pass', type: 'Unit', feature: 'Payment', risk: 'medium', description: 'Tests partial refund calculation', duration: '28ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-008', title: 'Empty cart checkout blocked', status: 'pass', type: 'Unit', feature: 'Checkout', risk: 'medium', description: 'Tests that empty cart cannot proceed to checkout', duration: '15ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-009', title: 'Coupon discount rounding', status: 'suspect', type: 'Unit', feature: 'Coupon', risk: 'medium', description: 'Tests discount rounding to 2 decimal places', aiNote: 'Spec says round down, test rounds up', noteType: 'warn', duration: '12ms', lastRun: '2 min ago', runs: [1,1,1,0,1] },
  { id: 'T-010', title: 'Mobile checkout responsive', status: 'pass', type: 'Mobile', feature: 'Checkout', risk: 'high', description: 'Tests checkout UI on mobile viewport', duration: '6.1s', lastRun: '15 min ago', runs: [1,1,1,1,1] },
  { id: 'T-011', title: 'Apply percentage coupon', status: 'pass', type: 'Unit', feature: 'Coupon', risk: 'medium', description: 'Tests percentage-based coupon calculation', duration: '22ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-012', title: 'Apply fixed amount coupon', status: 'pass', type: 'Unit', feature: 'Coupon', risk: 'medium', description: 'Tests fixed-amount coupon deduction', duration: '19ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-013', title: 'Coupon minimum purchase', status: 'fail', type: 'Unit', feature: 'Coupon', risk: 'high', description: 'Tests coupon requires minimum cart value', aiNote: 'Missing: minimum check bypassed', duration: '31ms', lastRun: '5 min ago', runs: [1,1,0,1,0] },
  { id: 'T-014', title: 'Payment retry after decline', status: 'pass', type: 'UI/Browser', feature: 'Payment', risk: 'high', description: 'Tests user can retry payment after decline', duration: '5.8s', lastRun: '10 min ago', runs: [1,1,1,1,1] },
  { id: 'T-015', title: 'Tax calculation accuracy', status: 'pass', type: 'Unit', feature: 'Checkout', risk: 'medium', description: 'Tests tax calculation for different regions', duration: '45ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-016', title: 'Shipping cost calculation', status: 'pass', type: 'Unit', feature: 'Checkout', risk: 'low', description: 'Tests shipping cost based on weight and region', duration: '33ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-017', title: 'Order confirmation email', status: 'pass', type: 'Integration', feature: 'Checkout', risk: 'medium', description: 'Tests confirmation email is sent after order', duration: '890ms', lastRun: '10 min ago', runs: [1,1,1,1,1] },
  { id: 'T-018', title: 'Invalid coupon format', status: 'pass', type: 'Unit', feature: 'Coupon', risk: 'low', description: 'Tests invalid coupon format rejection', duration: '11ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-019', title: 'Coupon usage limit', status: 'suspect', type: 'Unit', feature: 'Coupon', risk: 'high', description: 'Tests coupon usage limit per user', aiNote: 'Spec says per-account, test checks per-email', noteType: 'warn', duration: '27ms', lastRun: '2 min ago', runs: [1,1,1,1,0] },
  { id: 'T-020', title: 'Refund full amount', status: 'pass', type: 'Integration', feature: 'Payment', risk: 'high', description: 'Tests full refund processing', duration: '445ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-021', title: 'Checkout timeout handling', status: 'fail', type: 'UI/Browser', feature: 'Checkout', risk: 'high', description: 'Tests checkout session timeout behavior', aiNote: 'Timeout not triggered in test', noteType: 'warn', duration: '12.3s', lastRun: '10 min ago', runs: [1,0,0,0,0] },
  { id: 'T-022', title: 'Currency conversion', status: 'pass', type: 'Unit', feature: 'Payment', risk: 'medium', description: 'Tests multi-currency conversion at checkout', duration: '56ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-023', title: 'Promo code case sensitivity', status: 'pass', type: 'Unit', feature: 'Coupon', risk: 'low', description: 'Tests promo codes are case-insensitive', duration: '14ms', lastRun: '2 min ago', runs: [1,1,1,1,1] },
  { id: 'T-024', title: 'Mobile payment sheet', status: 'pass', type: 'Mobile', feature: 'Payment', risk: 'high', description: 'Tests native payment sheet on iOS/Android', duration: '7.2s', lastRun: '15 min ago', runs: [1,1,1,1,1] },
];

export const insights: Insight[] = [
  { id: 'I-001', severity: 'high', title: 'Missing coupon edge-case tests', description: '4 edge cases for coupon validation are not covered: minimum purchase bypass, stacking after refactor, timezone expiry, and usage limit per account.', action: 'Generate 4 tests', relatedTests: ['T-003', 'T-013', 'T-019'] },
  { id: 'I-002', severity: 'high', title: 'Suspicious payment test conflicts with spec', description: 'T-009 rounds discount up but spec says round down. T-019 checks per-email but spec says per-account.', action: 'Review tests', relatedTests: ['T-009', 'T-019'] },
  { id: 'I-003', severity: 'medium', title: 'Flaky payment decline test', description: 'T-006 fails intermittently due to timing issue with mock server response.', action: 'Fix flaky test', relatedTests: ['T-006'] },
  { id: 'I-004', severity: 'medium', title: 'Checkout timeout test not triggering', description: 'T-021 timeout test does not actually trigger the session timeout mechanism.', action: 'Fix test', relatedTests: ['T-021'] },
  { id: 'I-005', severity: 'low', title: 'Low branch coverage in payment module', description: 'Payment module has 52% branch coverage. Error handling paths are mostly untested.', action: 'Improve coverage', relatedTests: ['T-005', 'T-006', 'T-007'] },
  { id: 'I-006', severity: 'low', title: 'Mobile tests outdated', description: 'Mobile tests use iPhone 12 viewport. iPhone 15 and Pixel 7 should be added.', action: 'Update tests', relatedTests: ['T-010', 'T-024'] },
];

export const modules: Module[] = [
  { path: 'src/services/coupon', name: 'Coupon Service', coverage: 78, branchCoverage: 62, tests: { unit: 12, integration: 4, e2e: 2 } },
  { path: 'src/services/payment', name: 'Payment Service', coverage: 71, branchCoverage: 52, tests: { unit: 8, integration: 6, e2e: 3 } },
  { path: 'src/routes/checkout', name: 'Checkout Routes', coverage: 65, branchCoverage: 48, tests: { unit: 6, integration: 3, e2e: 4 } },
  { path: 'src/middleware/auth', name: 'Auth Middleware', coverage: 88, branchCoverage: 76, tests: { unit: 10, integration: 2, e2e: 1 } },
  { path: 'src/utils/validation', name: 'Validation Utils', coverage: 92, branchCoverage: 85, tests: { unit: 15, integration: 1, e2e: 0 } },
  { path: 'src/services/shipping', name: 'Shipping Service', coverage: 45, branchCoverage: 31, tests: { unit: 4, integration: 2, e2e: 1 } },
];

export const coverage = modules.map(m => ({ name: m.name, line: m.coverage, branch: m.branchCoverage }));

export const heatmap: HeatmapCell[] = modules.map(m => ({
  module: m.name,
  missing: m.coverage < 60 ? 3 : m.coverage < 80 ? 1 : 0,
  suspicious: m.name.includes('Coupon') ? 2 : m.name.includes('Payment') ? 0 : 0,
  flaky: m.name.includes('Payment') ? 1 : 0,
  failed: m.name.includes('Checkout') ? 2 : m.name.includes('Coupon') ? 1 : 0,
}));

export const heatmapCols = ['Module', 'Missing', 'Suspicious', 'Flaky', 'Failed'];
