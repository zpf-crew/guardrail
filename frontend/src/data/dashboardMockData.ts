import type { DashboardPayload } from '@/types/testlens';

/**
 * Mock Dashboard payload — shaped EXACTLY like the inter-team contract
 * (`DashboardPayload`). This is the single fixture the data seam resolves when
 * no real API is configured, so swapping in the live endpoint is a no-op for
 * the UI.
 *
 * Timestamps are derived from "now" at module load so the demo always reads
 * fresh ("2 min ago") rather than drifting to "3 days ago".
 */

/** ISO timestamp for `m` minutes before now. */
const minsAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString();

export const mockDashboard: DashboardPayload = {
  repo: {
    name: 'checkout-service',
    path: '/Users/dev/projects/checkout-service',
    branch: 'feature/coupon-refactor',
    commit: 'a1b2c3d',
  },
  lastScanAt: minsAgo(4),
  filesIndexed: 2418,

  health: {
    score: 72,
    max: 100,
    grade: 'C+',
    trend: { value: 3, sentiment: 'good', basis: 'this week' },
    note: 'Improving — suspicious tests fixed',
  },

  metrics: {
    totalTests: { value: 24, trend: { value: 5, sentiment: 'good', basis: 'vs last scan' } },
    passed: { value: 14, trend: { value: 4, sentiment: 'good', basis: 'vs last scan' } },
    failed: { value: 3, trend: { value: -3, sentiment: 'good', basis: 'vs last scan' } },
    flaky: { value: 2, trend: { value: 1, sentiment: 'bad', basis: 'vs last scan' } },
    missing: { value: 4, trend: { value: 5, sentiment: 'bad', basis: 'vs last scan' } },
    suspicious: { value: 2, trend: { value: 1, sentiment: 'bad', basis: 'vs last scan' } },
    coverage: { value: 71.4, isPercent: true, trend: { value: 4.2, sentiment: 'good', basis: 'vs last scan' } },
    highRiskOpen: { value: 5, trend: { value: -2, sentiment: 'good', basis: 'vs last scan' } },
  },

  testCases: [
    { id: 'T-001', title: 'Apply valid coupon at checkout', status: 'passed', type: 'Unit', feature: 'Coupon', risk: 'High', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests that a valid coupon code applies the correct discount', aiNote: { text: 'Well-covered, 5 assertions', tone: 'info' } },
    { id: 'T-002', title: 'Reject expired coupon', status: 'passed', type: 'Unit', feature: 'Coupon', risk: 'High', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests that expired coupons are rejected with proper error' },
    { id: 'T-003', title: 'Stack multiple coupons', status: 'failed', type: 'Integration', feature: 'Coupon', risk: 'High', lastRunAt: minsAgo(5), recentRuns: [1, 1, 0, 1, 1], description: 'Tests that only one coupon can be applied at a time', aiNote: { text: 'Fails: allows stacking after refactor', tone: 'warn' } },
    { id: 'T-004', title: 'Guest checkout flow', status: 'passed', type: 'UI / Browser', feature: 'Checkout', risk: 'High', lastRunAt: minsAgo(10), recentRuns: [1, 1, 1, 1, 1], description: 'End-to-end guest checkout with payment' },
    { id: 'T-005', title: 'Card payment success', status: 'passed', type: 'Integration', feature: 'Payment', risk: 'High', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests successful card payment processing' },
    { id: 'T-006', title: 'Card payment declined', status: 'flaky', type: 'Integration', feature: 'Payment', risk: 'High', lastRunAt: minsAgo(8), recentRuns: [1, 0, 1, 0, 0], description: 'Tests declined card handling', aiNote: { text: 'Flaky: timing issue with mock server', tone: 'warn' } },
    { id: 'T-007', title: 'Partial refund processing', status: 'passed', type: 'Unit', feature: 'Payment', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests partial refund calculation' },
    { id: 'T-008', title: 'Empty cart checkout blocked', status: 'passed', type: 'Unit', feature: 'Checkout', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests that empty cart cannot proceed to checkout' },
    { id: 'T-009', title: 'Coupon discount rounding', status: 'suspicious', type: 'Unit', feature: 'Coupon', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 0, 1], description: 'Tests discount rounding to 2 decimal places', aiNote: { text: 'Spec says round down, test rounds up', tone: 'warn' } },
    { id: 'T-010', title: 'Mobile checkout responsive', status: 'passed', type: 'Mobile', feature: 'Checkout', risk: 'High', lastRunAt: minsAgo(15), recentRuns: [1, 1, 1, 1, 1], description: 'Tests checkout UI on mobile viewport' },
    { id: 'T-011', title: 'Apply percentage coupon', status: 'passed', type: 'Unit', feature: 'Coupon', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests percentage-based coupon calculation' },
    { id: 'T-012', title: 'Apply fixed amount coupon', status: 'passed', type: 'Unit', feature: 'Coupon', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests fixed-amount coupon deduction' },
    { id: 'T-013', title: 'Coupon minimum purchase', status: 'failed', type: 'Unit', feature: 'Coupon', risk: 'High', lastRunAt: minsAgo(5), recentRuns: [1, 1, 0, 1, 0], description: 'Tests coupon requires minimum cart value', aiNote: { text: 'Missing: minimum check bypassed', tone: 'warn' } },
    { id: 'T-014', title: 'Payment retry after decline', status: 'passed', type: 'UI / Browser', feature: 'Payment', risk: 'High', lastRunAt: minsAgo(10), recentRuns: [1, 1, 1, 1, 1], description: 'Tests user can retry payment after decline' },
    { id: 'T-015', title: 'Tax calculation accuracy', status: 'passed', type: 'Unit', feature: 'Checkout', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests tax calculation for different regions' },
    { id: 'T-016', title: 'Shipping cost calculation', status: 'passed', type: 'Unit', feature: 'Checkout', risk: 'Low', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests shipping cost based on weight and region' },
    { id: 'T-017', title: 'Order confirmation email', status: 'passed', type: 'Integration', feature: 'Checkout', risk: 'Medium', lastRunAt: minsAgo(10), recentRuns: [1, 1, 1, 1, 1], description: 'Tests confirmation email is sent after order' },
    { id: 'T-018', title: 'Invalid coupon format', status: 'passed', type: 'Unit', feature: 'Coupon', risk: 'Low', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests invalid coupon format rejection' },
    { id: 'T-019', title: 'Coupon usage limit', status: 'suspicious', type: 'Unit', feature: 'Coupon', risk: 'High', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 0], description: 'Tests coupon usage limit per user', aiNote: { text: 'Spec says per-account, test checks per-email', tone: 'warn' } },
    { id: 'T-020', title: 'Refund full amount', status: 'passed', type: 'Integration', feature: 'Payment', risk: 'High', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests full refund processing' },
    { id: 'T-021', title: 'Checkout timeout handling', status: 'failed', type: 'UI / Browser', feature: 'Checkout', risk: 'High', lastRunAt: minsAgo(10), recentRuns: [1, 0, 0, 0, 0], description: 'Tests checkout session timeout behavior', aiNote: { text: 'Timeout not triggered in test', tone: 'warn' } },
    { id: 'T-022', title: 'Currency conversion', status: 'passed', type: 'Unit', feature: 'Payment', risk: 'Medium', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests multi-currency conversion at checkout' },
    { id: 'T-023', title: 'Promo code case sensitivity', status: 'passed', type: 'Unit', feature: 'Coupon', risk: 'Low', lastRunAt: minsAgo(2), recentRuns: [1, 1, 1, 1, 1], description: 'Tests promo codes are case-insensitive' },
    { id: 'T-024', title: 'Mobile payment sheet', status: 'passed', type: 'Mobile', feature: 'Payment', risk: 'High', lastRunAt: minsAgo(15), recentRuns: [1, 1, 1, 1, 1], description: 'Tests native payment sheet on iOS/Android' },
  ],

  insights: [
    { id: 'I-001', severity: 'High', title: 'Missing coupon edge-case tests', description: '4 edge cases for coupon validation are not covered: minimum purchase bypass, stacking after refactor, timezone expiry, and usage limit per account.', action: 'Generate missing tests', relatedTestIds: ['T-003', 'T-013', 'T-019'], meta: '4 gaps · Coupon' },
    { id: 'I-002', severity: 'High', title: 'Suspicious payment test conflicts with spec', description: 'T-009 rounds discount up but spec says round down. T-019 checks per-email but spec says per-account.', action: 'Review suspicious tests', relatedTestIds: ['T-009', 'T-019'], meta: '2 spec mismatches · Coupon' },
    { id: 'I-003', severity: 'Medium', title: 'Flaky payment decline test', description: 'T-006 fails intermittently due to timing issue with mock server response.', action: 'Explain failure', relatedTestIds: ['T-006'], meta: '1 flaky · Payment' },
    { id: 'I-004', severity: 'Medium', title: 'Checkout timeout test not triggering', description: 'T-021 timeout test does not actually trigger the session timeout mechanism.', action: 'Explain failure', relatedTestIds: ['T-021'], meta: '1 failure · Checkout' },
    { id: 'I-005', severity: 'Low', title: 'Low branch coverage in payment module', description: 'Payment module has 52% branch coverage. Error handling paths are mostly untested.', action: 'Create refactor plan', relatedTestIds: ['T-005', 'T-006', 'T-007'], meta: '52% branch · Payment' },
    { id: 'I-006', severity: 'Low', title: 'Mobile tests outdated', description: 'Mobile tests use iPhone 12 viewport. iPhone 15 and Pixel 7 should be added.', action: 'Open related test cases', relatedTestIds: ['T-010', 'T-024'], meta: '2 tests · Mobile' },
  ],

  structure: [
    { pathPrefix: 'src/services/coupon/', name: 'Coupon Service', coverage: 78, counts: [{ label: 'Unit', count: 12, kind: 'unit' }, { label: 'Integration', count: 4, kind: 'integration' }, { label: 'E2E', count: 2, kind: 'other' }] },
    { pathPrefix: 'src/services/payment/', name: 'Payment Service', coverage: 71, counts: [{ label: 'Unit', count: 8, kind: 'unit' }, { label: 'Integration', count: 6, kind: 'integration' }, { label: 'E2E', count: 3, kind: 'other' }] },
    { pathPrefix: 'src/routes/checkout/', name: 'Checkout Routes', coverage: 65, counts: [{ label: 'Unit', count: 6, kind: 'unit' }, { label: 'Integration', count: 3, kind: 'integration' }, { label: 'E2E', count: 4, kind: 'other' }] },
    { pathPrefix: 'src/middleware/auth/', name: 'Auth Middleware', coverage: 88, counts: [{ label: 'Unit', count: 10, kind: 'unit' }, { label: 'Integration', count: 2, kind: 'integration' }, { label: 'E2E', count: 1, kind: 'other' }] },
    { pathPrefix: 'src/utils/validation/', name: 'Validation Utils', coverage: 92, counts: [{ label: 'Unit', count: 15, kind: 'unit' }, { label: 'Integration', count: 1, kind: 'integration' }, { label: 'E2E', count: 0, kind: 'other' }] },
    { pathPrefix: 'src/services/shipping/', name: 'Shipping Service', coverage: 45, counts: [{ label: 'Unit', count: 4, kind: 'unit' }, { label: 'Integration', count: 2, kind: 'integration' }, { label: 'E2E', count: 1, kind: 'other' }] },
  ],

  coverage: [
    { module: 'Coupon Service', line: 78, branch: 62 },
    { module: 'Payment Service', line: 71, branch: 52 },
    { module: 'Checkout Routes', line: 65, branch: 48 },
    { module: 'Auth Middleware', line: 88, branch: 76 },
    { module: 'Validation Utils', line: 92, branch: 85 },
    { module: 'Shipping Service', line: 45, branch: 31 },
  ],

  // Severity per cell 0..3, columns in order: Failed, Flaky, Missing, Suspect.
  riskHeatmap: {
    columns: ['Failed', 'Flaky', 'Missing', 'Suspect'],
    rows: [
      { module: 'Coupon Service', values: [1, 0, 1, 2] },
      { module: 'Payment Service', values: [0, 1, 1, 0] },
      { module: 'Checkout Routes', values: [2, 0, 1, 0] },
      { module: 'Auth Middleware', values: [0, 0, 0, 0] },
      { module: 'Validation Utils', values: [0, 0, 0, 0] },
      { module: 'Shipping Service', values: [0, 0, 3, 0] },
    ],
  },

  activity: [
    { id: 'A-1', state: 'done', title: 'Scanned repository checkout-service', at: minsAgo(6), detail: '2,418 files indexed' },
    { id: 'A-2', state: 'done', title: 'Parsed coverage report (lcov)', at: minsAgo(6), detail: '71.4% line coverage' },
    { id: 'A-3', state: 'done', title: 'Found 7 missing recommended test cases', at: minsAgo(5), detail: 'coupon, payment, session' },
    { id: 'A-4', state: 'done', title: 'Detected 3 suspicious tests vs. spec', at: minsAgo(5), detail: 'expired coupon, retry, rounding' },
    { id: 'A-5', state: 'done', title: 'Generated 3 test suggestions', at: minsAgo(4), detail: 'ready to draft 4 more' },
    { id: 'A-6', state: 'active', title: 'Waiting for approval to create test files', at: minsAgo(0), detail: '7 files staged', awaitingApproval: true },
  ],
};
