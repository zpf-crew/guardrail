import type { DiffLine } from '../components/ui/code-diff';

export interface QuickAction {
  title: string;
  description: string;
  icon: string;
}

export const quickActions: QuickAction[] = [
  { title: 'Generate missing coupon tests', description: '4 missing edge-case tests', icon: '🧪' },
  { title: 'Fix suspicious payment tests', description: '2 tests conflict with specs', icon: '🔧' },
  { title: 'Fix flaky payment decline test', description: 'T-006 timing issue', icon: '⚡' },
  { title: 'Add UI tests for checkout timeout', description: 'Actually triggers timeout', icon: '🖥️' },
  { title: 'Update mobile test devices', description: 'iPhone 15 + Pixel 7', icon: '📱' },
];

export interface ClassificationCard {
  behavior: string;
  status: 'covered' | 'missing' | 'weak' | 'suspicious';
  type: string;
  risk: 'low' | 'medium' | 'high';
  explanation: string;
}

export const classification: ClassificationCard[] = [
  { behavior: 'Coupon minimum purchase validation', status: 'missing', type: 'Edge case', risk: 'high', explanation: 'No test verifies cart must meet minimum' },
  { behavior: 'Coupon timezone expiry', status: 'missing', type: 'Edge case', risk: 'high', explanation: 'Expiry not tested across timezones' },
  { behavior: 'Coupon usage limit per account', status: 'suspicious', type: 'Logic', risk: 'medium', explanation: 'Spec says per-account, test checks per-email' },
  { behavior: 'Coupon stacking prevention', status: 'weak', type: 'Edge case', risk: 'high', explanation: 'Test passes but stacking was accidentally allowed' },
  { behavior: 'Coupon discount rounding', status: 'covered', type: 'Logic', risk: 'low', explanation: 'Test exists but rounds up instead of down per spec' },
  { behavior: 'Checkout timeout behavior', status: 'missing', type: 'UI flow', risk: 'high', explanation: 'Existing test does not trigger actual timeout' },
  { behavior: 'Payment decline retry', status: 'missing', type: 'UI flow', risk: 'high', explanation: 'No test for retry after payment failure' },
  { behavior: 'Mobile checkout on new devices', status: 'missing', type: 'Device', risk: 'medium', explanation: 'iPhone 15 and Pixel 7 not covered' },
];

export interface PlanAction {
  action: string;
  count: number;
}

export const planActions: PlanAction[] = [
  { action: 'Add tests', count: 9 },
  { action: 'Update tests', count: 1 },
  { action: 'Delete tests', count: 1 },
  { action: 'Edit production code', count: 1 },
];

export interface PlanRisk {
  item: string;
  level: 'low' | 'medium' | 'high';
}

export const planRisk: PlanRisk[] = [
  { item: 'Production code change in coupon.ts', level: 'high' },
  { item: 'Mobile tests on new devices', level: 'medium' },
  { item: 'UI tests for timeout flow', level: 'medium' },
  { item: 'Open AI questions', level: 'low' },
];

export interface ChangeCard {
  id: string;
  title: string;
  file: string;
  changeType: 'add' | 'update' | 'delete';
  testType: 'unit' | 'ui' | 'mobile';
  feature: string;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  diff: DiffLine[];
}

export interface MatrixRow {
  name: string;
  type: string;
  status: 'pass' | 'fail' | 'running';
  duration: string;
  evidence?: string;
  file: string;
}

export type PlanFilePath = string;

export const planFiles: PlanFilePath[] = [
  'src/services/coupon/coupon.test.ts',
  'src/services/coupon/coupon.ts',
  'src/services/payment/payment.test.ts',
  'src/routes/checkout/checkout.e2e.ts',
  'tests/mobile/checkout.mobile.ts',
];

export interface AIQuestion {
  question: string;
  options: string[];
}

export const aiQuestions: AIQuestion[] = [
  {
    question: 'Should expired coupons show a generic error or specific message?',
    options: ['Generic: "Invalid coupon"', 'Specific: "Coupon expired on [date]"', 'Both: specific with fallback'],
  },
  {
    question: 'Should mobile tests run on real devices or simulators?',
    options: ['Simulators (faster)', 'Real devices (more accurate)', 'Both (comprehensive)'],
  },
  {
    question: 'What is the expected behavior when stacking coupons?',
    options: ['Reject with error', 'Apply only the best coupon', 'Apply first valid coupon'],
  },
];

export interface TimelineItem {
  label: string;
  state: string;
}

export const genTimeline: TimelineItem[] = [
  { label: 'Analyzing source files', state: 'done' },
  { label: 'Reading product specs', state: 'done' },
  { label: 'Importing QC cases', state: 'done' },
  { label: 'Classifying behaviors', state: 'done' },
  { label: 'Generating test plan', state: 'done' },
  { label: 'Writing unit tests', state: 'done' },
  { label: 'Writing UI/browser tests', state: 'done' },
  { label: 'Writing mobile tests', state: 'done' },
  { label: 'Updating suspicious tests', state: 'done' },
  { label: 'Deleting outdated tests', state: 'done' },
  { label: 'Collecting coverage', state: 'done' },
];

export const changes: ChangeCard[] = [
  {
    id: 'C-001', title: 'Add test: coupon minimum purchase validation', file: 'src/services/coupon/coupon.test.ts',
    changeType: 'add', testType: 'unit', feature: 'Coupon', risk: 'high',
    reason: 'Missing: no test verifies minimum cart value requirement',
    diff: [
      { type: 'meta', content: '--- a/src/services/coupon/coupon.test.ts' },
      { type: 'meta', content: '+++ b/src/services/coupon/coupon.test.ts' },
      { type: 'ctx', content: ' import { applyCoupon } from "./coupon";' },
      { type: 'ctx', content: '' },
      { type: 'ctx', content: ' describe("applyCoupon", () => {' },
      { type: 'add', content: '+  it("rejects coupon when cart below minimum", () => {' },
      { type: 'add', content: '+    const cart = { items: [], total: 5 };' },
      { type: 'add', content: '+    const coupon = { code: "SAVE10", minPurchase: 20 };' },
      { type: 'add', content: '+    expect(() => applyCoupon(cart, coupon)).toThrow("Minimum purchase required");' },
      { type: 'add', content: '+  });' },
      { type: 'ctx', content: ' });' },
    ],
  },
  {
    id: 'C-002', title: 'Add test: coupon timezone expiry', file: 'src/services/coupon/coupon.test.ts',
    changeType: 'add', testType: 'unit', feature: 'Coupon', risk: 'high',
    reason: 'Missing: coupon expiry not tested across timezones',
    diff: [
      { type: 'meta', content: '--- a/src/services/coupon/coupon.test.ts' },
      { type: 'meta', content: '+++ b/src/services/coupon/coupon.test.ts' },
      { type: 'add', content: '+  it("rejects coupon expired in user timezone", () => {' },
      { type: 'add', content: '+    const coupon = { code: "FLASH", expiresAt: "2024-01-01T00:00:00Z" };' },
      { type: 'add', content: '+    jest.setSystemTime(new Date("2024-01-02T00:00:00Z"));' },
      { type: 'add', content: '+    expect(() => applyCoupon(cart, coupon)).toThrow("Coupon expired");' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-003', title: 'Add test: coupon usage limit per account', file: 'src/services/coupon/coupon.test.ts',
    changeType: 'add', testType: 'unit', feature: 'Coupon', risk: 'high',
    reason: 'Spec says per-account limit, current test checks per-email',
    diff: [
      { type: 'meta', content: '--- a/src/services/coupon/coupon.test.ts' },
      { type: 'meta', content: '+++ b/src/services/coupon/coupon.test.ts' },
      { type: 'add', content: '+  it("enforces usage limit per account, not email", () => {' },
      { type: 'add', content: '+    const coupon = { code: "ONCE", usageLimit: 1, scope: "account" };' },
      { type: 'add', content: '+    applyCoupon(cart1, coupon, accountId);' },
      { type: 'add', content: '+    expect(() => applyCoupon(cart2, coupon, accountId)).toThrow("Usage limit reached");' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-004', title: 'Add test: coupon stacking prevention', file: 'src/services/coupon/coupon.test.ts',
    changeType: 'add', testType: 'unit', feature: 'Coupon', risk: 'high',
    reason: 'After refactor, stacking was accidentally allowed',
    diff: [
      { type: 'meta', content: '--- a/src/services/coupon/coupon.test.ts' },
      { type: 'meta', content: '+++ b/src/services/coupon/coupon.test.ts' },
      { type: 'add', content: '+  it("prevents stacking multiple coupons", () => {' },
      { type: 'add', content: '+    applyCoupon(cart, coupon1);' },
      { type: 'add', content: '+    expect(() => applyCoupon(cart, coupon2)).toThrow("Only one coupon allowed");' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-005', title: 'Add UI test: checkout timeout behavior', file: 'src/routes/checkout/checkout.e2e.ts',
    changeType: 'add', testType: 'ui', feature: 'Checkout', risk: 'high',
    reason: 'Existing test does not trigger actual timeout',
    diff: [
      { type: 'meta', content: '--- a/src/routes/checkout/checkout.e2e.ts' },
      { type: 'meta', content: '+++ b/src/routes/checkout/checkout.e2e.ts' },
      { type: 'add', content: '+  it("shows timeout message after session expires", async () => {' },
      { type: 'add', content: '+    await page.goto("/checkout");' },
      { type: 'add', content: '+    await page.evaluate(() => jest.advanceTimersByTime(1800000));' },
      { type: 'add', content: '+    await expect(page.locator(".timeout-message")).toBeVisible();' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-006', title: 'Add UI test: coupon error message display', file: 'src/routes/checkout/checkout.e2e.ts',
    changeType: 'add', testType: 'ui', feature: 'Coupon', risk: 'medium',
    reason: 'Visual verification of error messages',
    diff: [
      { type: 'meta', content: '--- a/src/routes/checkout/checkout.e2e.ts' },
      { type: 'meta', content: '+++ b/src/routes/checkout/checkout.e2e.ts' },
      { type: 'add', content: '+  it("shows specific expired coupon error", async () => {' },
      { type: 'add', content: '+    await page.fill("#coupon-input", "EXPIRED");' },
      { type: 'add', content: '+    await page.click("#apply-coupon");' },
      { type: 'add', content: '+    await expect(page.locator(".error")).toContainText("Coupon expired");' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-007', title: 'Add UI test: payment decline retry flow', file: 'src/routes/checkout/checkout.e2e.ts',
    changeType: 'add', testType: 'ui', feature: 'Payment', risk: 'high',
    reason: 'Tests user can retry after payment decline',
    diff: [
      { type: 'meta', content: '--- a/src/routes/checkout/checkout.e2e.ts' },
      { type: 'meta', content: '+++ b/src/routes/checkout/checkout.e2e.ts' },
      { type: 'add', content: '+  it("allows retry after payment decline", async () => {' },
      { type: 'add', content: '+    await page.mock("/api/payment", { status: 402 });' },
      { type: 'add', content: '+    await page.click("#pay-button");' },
      { type: 'add', content: '+    await expect(page.locator(".decline-error")).toBeVisible();' },
      { type: 'add', content: '+    await page.mock("/api/payment", { status: 200 });' },
      { type: 'add', content: '+    await page.click("#retry-button");' },
      { type: 'add', content: '+    await expect(page.locator(".success")).toBeVisible();' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-008', title: 'Add mobile test: checkout on Pixel 7', file: 'tests/mobile/checkout.mobile.ts',
    changeType: 'add', testType: 'mobile', feature: 'Checkout', risk: 'high',
    reason: 'New device not covered',
    diff: [
      { type: 'meta', content: '--- a/tests/mobile/checkout.mobile.ts' },
      { type: 'meta', content: '+++ b/tests/mobile/checkout.mobile.ts' },
      { type: 'add', content: '+  it("checkout flow works on Pixel 7", async () => {' },
      { type: 'add', content: '+    await device.setDevice("Pixel 7");' },
      { type: 'add', content: '+    await page.goto("/checkout");' },
      { type: 'add', content: '+    await expect(page.locator(".checkout-form")).toBeVisible();' },
      { type: 'add', content: '+    await page.fill("#coupon-input", "SAVE10");' },
      { type: 'add', content: '+    await expect(page.locator(".discount")).toContainText("-$10.00");' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-009', title: 'Add mobile test: payment sheet on iPhone 15', file: 'tests/mobile/checkout.mobile.ts',
    changeType: 'add', testType: 'mobile', feature: 'Payment', risk: 'high',
    reason: 'New device not covered',
    diff: [
      { type: 'meta', content: '--- a/tests/mobile/checkout.mobile.ts' },
      { type: 'meta', content: '+++ b/tests/mobile/checkout.mobile.ts' },
      { type: 'add', content: '+  it("Apple Pay sheet appears on iPhone 15", async () => {' },
      { type: 'add', content: '+    await device.setDevice("iPhone 15");' },
      { type: 'add', content: '+    await page.click("#apple-pay-button");' },
      { type: 'add', content: '+    await expect(page.locator(".apple-pay-sheet")).toBeVisible();' },
      { type: 'add', content: '+  });' },
    ],
  },
  {
    id: 'C-010', title: 'Fix: coupon rounding test (spec conflict)', file: 'src/services/coupon/coupon.test.ts',
    changeType: 'update', testType: 'unit', feature: 'Coupon', risk: 'medium',
    reason: 'Spec says round down, test rounds up',
    diff: [
      { type: 'meta', content: '--- a/src/services/coupon/coupon.test.ts' },
      { type: 'meta', content: '+++ b/src/services/coupon/coupon.test.ts' },
      { type: 'ctx', content: '   it("rounds discount correctly", () => {' },
      { type: 'del', content: '-    expect(roundDiscount(33.333)).toBe(33.34);' },
      { type: 'add', content: '+    expect(roundDiscount(33.333)).toBe(33.33);' },
      { type: 'ctx', content: '   });' },
    ],
  },
  {
    id: 'C-011', title: 'Delete: outdated coupon stacking test', file: 'src/services/coupon/coupon.test.ts',
    changeType: 'delete', testType: 'unit', feature: 'Coupon', risk: 'low',
    reason: 'Test allows stacking, which contradicts spec',
    diff: [
      { type: 'meta', content: '--- a/src/services/coupon/coupon.test.ts' },
      { type: 'meta', content: '+++ b/src/services/coupon/coupon.test.ts' },
      { type: 'del', content: '-  it("allows stacking multiple coupons", () => {' },
      { type: 'del', content: '-    applyCoupon(cart, coupon1);' },
      { type: 'del', content: '-    applyCoupon(cart, coupon2);' },
      { type: 'del', content: '-    expect(cart.discount).toBe(20);' },
      { type: 'del', content: '-  });' },
    ],
  },
];

export interface CovCompare {
  metric: string;
  before: number;
  after: number;
}

export const covCompare: CovCompare[] = [
  { metric: 'Line coverage', before: 64, after: 78 },
  { metric: 'Branch coverage', before: 52, after: 65 },
  { metric: 'Function coverage', before: 58, after: 72 },
  { metric: 'Changed files', before: 45, after: 82 },
];

export const matrix: MatrixRow[] = [
  { name: 'Apply valid coupon', type: 'Unit', status: 'pass', duration: '42ms', file: 'coupon.test.ts' },
  { name: 'Reject expired coupon', type: 'Unit', status: 'pass', duration: '38ms', file: 'coupon.test.ts' },
  { name: 'Coupon minimum purchase', type: 'Unit', status: 'pass', duration: '31ms', file: 'coupon.test.ts' },
  { name: 'Coupon timezone expiry', type: 'Unit', status: 'pass', duration: '29ms', file: 'coupon.test.ts' },
  { name: 'Coupon usage limit per account', type: 'Unit', status: 'pass', duration: '27ms', file: 'coupon.test.ts' },
  { name: 'Coupon stacking prevention', type: 'Unit', status: 'pass', duration: '24ms', file: 'coupon.test.ts' },
  { name: 'Checkout timeout behavior', type: 'UI/Browser', status: 'pass', duration: '3.2s', evidence: 'screenshot', file: 'checkout.e2e.ts' },
  { name: 'Coupon error message display', type: 'UI/Browser', status: 'pass', duration: '2.8s', evidence: 'screenshot', file: 'checkout.e2e.ts' },
  { name: 'Payment decline retry flow', type: 'UI/Browser', status: 'pass', duration: '4.1s', evidence: 'screenshot', file: 'checkout.e2e.ts' },
  { name: 'Checkout on Pixel 7', type: 'Mobile', status: 'pass', duration: '5.6s', evidence: 'device', file: 'checkout.mobile.ts' },
  { name: 'Payment sheet on iPhone 15', type: 'Mobile', status: 'fail', duration: '7.2s', evidence: 'device', file: 'checkout.mobile.ts' },
];

export interface ReviewStat {
  label: string;
  value: string;
}

export const reviewStats: ReviewStat[] = [
  { label: 'Tests added', value: '9' },
  { label: 'Tests updated', value: '1' },
  { label: 'Tests deleted', value: '1' },
  { label: 'Tests passing', value: '10/11' },
  { label: 'Line coverage', value: '64% → 78%' },
  { label: 'Branch coverage', value: '52% → 65%' },
  { label: 'Flaky tests', value: '0' },
  { label: 'Files changed', value: '6' },
];

export interface ReviewFile {
  path: string;
  additions: number;
  deletions: number;
}

export const reviewFiles: ReviewFile[] = [
  { path: 'src/services/coupon/coupon.test.ts', additions: 42, deletions: 5 },
  { path: 'src/services/coupon/coupon.ts', additions: 3, deletions: 1 },
  { path: 'src/routes/checkout/checkout.e2e.ts', additions: 28, deletions: 0 },
  { path: 'tests/mobile/checkout.mobile.ts', additions: 18, deletions: 0 },
  { path: 'src/services/payment/payment.test.ts', additions: 8, deletions: 2 },
  { path: 'src/middleware/auth/auth.test.ts', additions: 5, deletions: 0 },
];
