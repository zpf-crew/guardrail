import type {
  WorkbenchSession,
  IntentInput,
  QuickAction,
  GeneratedChange,
  TestResultRow,
} from '@/types/testlens';

/**
 * Mock Generate/Improve workbench — shaped as a fully-populated
 * `WorkbenchSession` (the inter-team contract). The data seam resolves this
 * when no real API is configured, so swapping in the live workbench endpoints
 * is a no-op for the UI.
 */

const repo = {
  name: 'checkout-service',
  path: '/Users/dev/projects/checkout-service',
  branch: 'feature/coupon-refactor',
  commit: 'a1b2c3d',
};

const guardrailRepo = {
  name: 'guardrail',
  path: '/Users/lap15961/Workspace/clawathon/guardrail',
  branch: 'main',
  commit: 'local',
};

/** Canned starting points surfaced from dashboard insights (Intent step). */
export const mockQuickActions: QuickAction[] = [
  { id: 'QA-1', label: 'Generate missing coupon tests', feature: 'Coupon', severity: 'High', testTypes: ['Unit', 'Edge Case'], sourceInsightId: 'I-001' },
  { id: 'QA-2', label: 'Fix suspicious payment tests', feature: 'Payment', severity: 'High', testTypes: ['Unit'], sourceInsightId: 'I-002' },
  { id: 'QA-3', label: 'Fix flaky payment decline test', feature: 'Payment', severity: 'Medium', testTypes: ['Integration'], sourceInsightId: 'I-003' },
  { id: 'QA-4', label: 'Add UI tests for checkout timeout', feature: 'Checkout', severity: 'Medium', testTypes: ['UI / Browser'], sourceInsightId: 'I-004' },
  { id: 'QA-5', label: 'Update mobile test devices', feature: 'Checkout', severity: 'Low', testTypes: ['Mobile'], sourceInsightId: 'I-006' },
];

const changes: GeneratedChange[] = [
  {
    id: 'C-001', action: 'Add', testType: 'Unit', title: 'Add test: coupon minimum purchase validation', file: 'src/services/coupon/coupon.test.ts', feature: 'Coupon', risk: 'High', status: 'staged',
    reason: 'Missing: no test verifies minimum cart value requirement',
    diff: [
      { kind: 'meta', text: '--- a/src/services/coupon/coupon.test.ts' },
      { kind: 'meta', text: '+++ b/src/services/coupon/coupon.test.ts' },
      { kind: 'context', text: ' describe("applyCoupon", () => {' },
      { kind: 'add', text: '+  it("rejects coupon when cart below minimum", () => {' },
      { kind: 'add', text: '+    const cart = { items: [], total: 5 };' },
      { kind: 'add', text: '+    const coupon = { code: "SAVE10", minPurchase: 20 };' },
      { kind: 'add', text: '+    expect(() => applyCoupon(cart, coupon)).toThrow("Minimum purchase required");' },
      { kind: 'add', text: '+  });' },
      { kind: 'context', text: ' });' },
    ],
  },
  {
    id: 'C-002', action: 'Add', testType: 'Unit', title: 'Add test: coupon timezone expiry', file: 'src/services/coupon/coupon.test.ts', feature: 'Coupon', risk: 'High', status: 'staged',
    reason: 'Missing: coupon expiry not tested across timezones',
    diff: [
      { kind: 'add', text: '+  it("rejects coupon expired in user timezone", () => {' },
      { kind: 'add', text: '+    const coupon = { code: "FLASH", expiresAt: "2024-01-01T00:00:00Z" };' },
      { kind: 'add', text: '+    jest.setSystemTime(new Date("2024-01-02T00:00:00Z"));' },
      { kind: 'add', text: '+    expect(() => applyCoupon(cart, coupon)).toThrow("Coupon expired");' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-003', action: 'Add', testType: 'Unit', title: 'Add test: coupon usage limit per account', file: 'src/services/coupon/coupon.test.ts', feature: 'Coupon', risk: 'High', status: 'staged',
    reason: 'Spec says per-account limit, current test checks per-email',
    diff: [
      { kind: 'add', text: '+  it("enforces usage limit per account, not email", () => {' },
      { kind: 'add', text: '+    const coupon = { code: "ONCE", usageLimit: 1, scope: "account" };' },
      { kind: 'add', text: '+    applyCoupon(cart1, coupon, accountId);' },
      { kind: 'add', text: '+    expect(() => applyCoupon(cart2, coupon, accountId)).toThrow("Usage limit reached");' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-004', action: 'Add', testType: 'Unit', title: 'Add test: coupon stacking prevention', file: 'src/services/coupon/coupon.test.ts', feature: 'Coupon', risk: 'High', status: 'staged',
    reason: 'After refactor, stacking was accidentally allowed',
    diff: [
      { kind: 'add', text: '+  it("prevents stacking multiple coupons", () => {' },
      { kind: 'add', text: '+    applyCoupon(cart, coupon1);' },
      { kind: 'add', text: '+    expect(() => applyCoupon(cart, coupon2)).toThrow("Only one coupon allowed");' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-005', action: 'Add', testType: 'UI / Browser', title: 'Add UI test: checkout timeout behavior', file: 'src/routes/checkout/checkout.e2e.ts', feature: 'Checkout', risk: 'High', status: 'staged',
    reason: 'Existing test does not trigger actual timeout',
    diff: [
      { kind: 'add', text: '+  it("shows timeout message after session expires", async () => {' },
      { kind: 'add', text: '+    await page.goto("/checkout");' },
      { kind: 'add', text: '+    await page.evaluate(() => jest.advanceTimersByTime(1800000));' },
      { kind: 'add', text: '+    await expect(page.locator(".timeout-message")).toBeVisible();' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-006', action: 'Add', testType: 'UI / Browser', title: 'Add UI test: coupon error message display', file: 'src/routes/checkout/checkout.e2e.ts', feature: 'Coupon', risk: 'Medium', status: 'staged',
    reason: 'Visual verification of error messages',
    diff: [
      { kind: 'add', text: '+  it("shows specific expired coupon error", async () => {' },
      { kind: 'add', text: '+    await page.fill("#coupon-input", "EXPIRED");' },
      { kind: 'add', text: '+    await page.click("#apply-coupon");' },
      { kind: 'add', text: '+    await expect(page.locator(".error")).toContainText("Coupon expired");' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-007', action: 'Add', testType: 'UI / Browser', title: 'Add UI test: payment decline retry flow', file: 'src/routes/checkout/checkout.e2e.ts', feature: 'Payment', risk: 'High', status: 'staged',
    reason: 'Tests user can retry after payment decline',
    diff: [
      { kind: 'add', text: '+  it("allows retry after payment decline", async () => {' },
      { kind: 'add', text: '+    await page.mock("/api/payment", { status: 402 });' },
      { kind: 'add', text: '+    await page.click("#pay-button");' },
      { kind: 'add', text: '+    await expect(page.locator(".decline-error")).toBeVisible();' },
      { kind: 'add', text: '+    await page.mock("/api/payment", { status: 200 });' },
      { kind: 'add', text: '+    await page.click("#retry-button");' },
      { kind: 'add', text: '+    await expect(page.locator(".success")).toBeVisible();' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-008', action: 'Add', testType: 'Mobile', title: 'Add mobile test: checkout on Pixel 7', file: 'tests/mobile/checkout.mobile.ts', feature: 'Checkout', risk: 'High', status: 'staged',
    reason: 'New device not covered',
    diff: [
      { kind: 'add', text: '+  it("checkout flow works on Pixel 7", async () => {' },
      { kind: 'add', text: '+    await device.setDevice("Pixel 7");' },
      { kind: 'add', text: '+    await page.goto("/checkout");' },
      { kind: 'add', text: '+    await expect(page.locator(".checkout-form")).toBeVisible();' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-009', action: 'Add', testType: 'Mobile', title: 'Add mobile test: payment sheet on iPhone 15', file: 'tests/mobile/checkout.mobile.ts', feature: 'Payment', risk: 'High', status: 'staged',
    reason: 'New device not covered',
    diff: [
      { kind: 'add', text: '+  it("Apple Pay sheet appears on iPhone 15", async () => {' },
      { kind: 'add', text: '+    await device.setDevice("iPhone 15");' },
      { kind: 'add', text: '+    await page.click("#apple-pay-button");' },
      { kind: 'add', text: '+    await expect(page.locator(".apple-pay-sheet")).toBeVisible();' },
      { kind: 'add', text: '+  });' },
    ],
  },
  {
    id: 'C-010', action: 'Update', testType: 'Unit', title: 'Fix: coupon rounding test (spec conflict)', file: 'src/services/coupon/coupon.test.ts', feature: 'Coupon', risk: 'Medium', status: 'staged',
    reason: 'Spec says round down, test rounds up',
    diff: [
      { kind: 'context', text: '   it("rounds discount correctly", () => {' },
      { kind: 'del', text: '-    expect(roundDiscount(33.333)).toBe(33.34);' },
      { kind: 'add', text: '+    expect(roundDiscount(33.333)).toBe(33.33);' },
      { kind: 'context', text: '   });' },
    ],
  },
  {
    id: 'C-011', action: 'Delete', testType: 'Unit', title: 'Delete: outdated coupon stacking test', file: 'src/services/coupon/coupon.test.ts', feature: 'Coupon', risk: 'Low', status: 'staged',
    reason: 'Test allows stacking, which contradicts spec',
    diff: [
      { kind: 'del', text: '-  it("allows stacking multiple coupons", () => {' },
      { kind: 'del', text: '-    applyCoupon(cart, coupon1);' },
      { kind: 'del', text: '-    applyCoupon(cart, coupon2);' },
      { kind: 'del', text: '-    expect(cart.discount).toBe(20);' },
      { kind: 'del', text: '-  });' },
    ],
  },
];

const matrix: TestResultRow[] = [
  { title: 'Apply valid coupon', type: 'Unit', status: 'Passed', duration: '42ms', evidence: null, file: 'coupon.test.ts' },
  { title: 'Reject expired coupon', type: 'Unit', status: 'Passed', duration: '38ms', evidence: null, file: 'coupon.test.ts' },
  { title: 'Coupon minimum purchase', type: 'Unit', status: 'Passed', duration: '31ms', evidence: null, file: 'coupon.test.ts' },
  { title: 'Coupon timezone expiry', type: 'Unit', status: 'Passed', duration: '29ms', evidence: null, file: 'coupon.test.ts' },
  { title: 'Coupon usage limit per account', type: 'Unit', status: 'Passed', duration: '27ms', evidence: null, file: 'coupon.test.ts' },
  { title: 'Coupon stacking prevention', type: 'Unit', status: 'Passed', duration: '24ms', evidence: null, file: 'coupon.test.ts' },
  { title: 'Checkout timeout behavior', type: 'UI / Browser', status: 'Passed', duration: '3.2s', evidence: 'screenshot', file: 'checkout.e2e.ts' },
  { title: 'Coupon error message display', type: 'UI / Browser', status: 'Passed', duration: '2.8s', evidence: 'screenshot', file: 'checkout.e2e.ts' },
  { title: 'Payment decline retry flow', type: 'UI / Browser', status: 'Passed', duration: '4.1s', evidence: 'screenshot', file: 'checkout.e2e.ts' },
  { title: 'Checkout on Pixel 7', type: 'Mobile', status: 'Passed', duration: '5.6s', evidence: 'device', file: 'checkout.mobile.ts' },
  { title: 'Payment sheet on iPhone 15', type: 'Mobile', status: 'Failed', duration: '7.2s', evidence: 'device', file: 'checkout.mobile.ts' },
];

export const mockWorkbench: WorkbenchSession = {
  id: 'WB-001',
  repo,
  createdAt: new Date().toISOString(),
  steps: { intent: 'active', isolation: 'locked', plan: 'locked', generate: 'locked', run: 'locked', review: 'locked' },

  intent: {
    prompt: '',
    feature: 'Coupon',
    testTypes: ['Unit'],
    sources: ['Codebase', 'Product specs / wiki', 'QC test cases', 'Existing automated tests'],
  },

  isolation: {
    target: { feature: 'Coupon', repo },
    sourceFiles: [
      { path: 'src/services/coupon/coupon.ts', kind: 'source', meta: '412 LOC' },
      { path: 'src/services/coupon/coupon.test.ts', kind: 'test', meta: '6 tests' },
    ],
    existingTestFiles: [
      { path: 'src/routes/checkout/checkout.e2e.ts', kind: 'test', meta: '4 tests' },
      { path: 'tests/mobile/checkout.mobile.ts', kind: 'test', meta: '2 tests' },
    ],
    specDocs: [
      { path: 'Checkout Flow Spec.pdf', kind: 'spec', meta: 'product spec' },
      { path: 'Coupon Rules.md', kind: 'spec', meta: 'product spec' },
    ],
    qcCases: [
      { id: 'QC-101', feature: 'Coupon', scenario: 'Apply expired coupon', expectedResult: 'Show "Coupon expired"', priority: 'High', automationStatus: 'missing' },
      { id: 'QC-102', feature: 'Coupon', scenario: 'Stack two coupons', expectedResult: 'Reject second coupon', priority: 'High', automationStatus: 'missing' },
    ],
    currentCoverage: { line: 64, branch: 52 },
    currentStatus: { failed: 1, suspicious: 1, missing: 4 },
    userJourneys: ['Apply coupon → checkout → pay', 'Expired coupon error', 'Stacked coupon block'],
    classifications: [
      { behavior: 'Coupon minimum purchase validation', status: 'Missing', suggestedTypes: ['Edge Case'], risk: 'High', explanation: 'No test verifies cart must meet minimum' },
      { behavior: 'Coupon timezone expiry', status: 'Missing', suggestedTypes: ['Edge Case'], risk: 'High', explanation: 'Expiry not tested across timezones' },
      { behavior: 'Coupon usage limit per account', status: 'Suspicious', suggestedTypes: ['Unit'], risk: 'Medium', explanation: 'Spec says per-account, test checks per-email' },
      { behavior: 'Coupon stacking prevention', status: 'Weak', suggestedTypes: ['Edge Case'], risk: 'High', explanation: 'Test passes but stacking was accidentally allowed' },
      { behavior: 'Coupon discount rounding', status: 'Covered', suggestedTypes: ['Unit'], risk: 'Low', explanation: 'Test exists but rounds up instead of down per spec' },
      { behavior: 'Checkout timeout behavior', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'Existing test does not trigger actual timeout' },
      { behavior: 'Payment decline retry', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'No test for retry after payment failure' },
      { behavior: 'Mobile checkout on new devices', status: 'Missing', suggestedTypes: ['Mobile'], risk: 'Medium', explanation: 'iPhone 15 and Pixel 7 not covered' },
    ],
  },

  plan: {
    proposedActions: [
      { action: 'add', label: 'Add tests', count: 9 },
      { action: 'update', label: 'Update tests', count: 1 },
      { action: 'delete', label: 'Delete tests', count: 1 },
      { action: 'run', label: 'Edit production code', count: 1 },
    ],
    risk: {
      productionCodeChanges: 'expected',
      testDataChanges: true,
      browserAutomationRequired: true,
      mobileSimulatorRequired: 'required',
      externalApiMocking: 'required',
    },
    filesToChange: [
      'src/services/coupon/coupon.test.ts',
      'src/services/coupon/coupon.ts',
      'src/services/payment/payment.test.ts',
      'src/routes/checkout/checkout.e2e.ts',
      'tests/mobile/checkout.mobile.ts',
    ],
    questions: [
      { id: 'Q1', question: 'Should expired coupons show a generic error or specific message?', options: ['Generic: "Invalid coupon"', 'Specific: "Coupon expired on [date]"', 'Both: specific with fallback'] },
      { id: 'Q2', question: 'Should mobile tests run on real devices or simulators?', options: ['Simulators (faster)', 'Real devices (more accurate)', 'Both (comprehensive)'] },
      { id: 'Q3', question: 'What is the expected behavior when stacking coupons?', options: ['Reject with error', 'Apply only the best coupon', 'Apply first valid coupon'] },
    ],
  },

  generation: {
    timeline: [
      { label: 'Analyzing source files', status: 'done' },
      { label: 'Reading product specs', status: 'done' },
      { label: 'Importing QC cases', status: 'done' },
      { label: 'Classifying behaviors', status: 'done' },
      { label: 'Generating test plan', status: 'done' },
      { label: 'Writing unit tests', status: 'done' },
      { label: 'Writing UI/browser tests', status: 'done' },
      { label: 'Writing mobile tests', status: 'done' },
      { label: 'Updating suspicious tests', status: 'done' },
      { label: 'Deleting outdated tests', status: 'done' },
      { label: 'Collecting coverage', status: 'done' },
    ],
    changes,
    beforeAfter: {
      before: ['0 tests for coupon minimum purchase', '0 timezone expiry tests', '1 outdated stacking test', '0 mobile tests for new devices'],
      after: ['9 new tests added', '1 test updated', '1 outdated test removed', '6 files changed'],
    },
  },

  run: {
    unit: { command: 'pnpm test --filter=unit', outcome: 'Passed', passed: 6, durationMs: 1200, suite: 'coupon.test.ts' },
    ui: { command: 'pnpm test:e2e', browser: 'Chromium', outcome: 'Passed', passed: 3, durationMs: 8400, visual: { matchPercent: 99.4, baseline: 'checkout-timeout' }, evidence: [{ kind: 'screenshot', label: 'timeout message visible', href: 'https://placehold.co/960x540/111827/818cf8?text=UI+Browser+Evidence' }] },
    mobile: { command: 'pnpm test:mobile', devices: ['Pixel 7', 'iPhone 15'], outcome: 'Failed', passed: 1, flaky: 0, durationMs: 12800, evidence: [{ kind: 'device-log', label: 'iPhone 15 retry log' }] },
    coverage: [
      { metric: 'Line coverage', before: 64, after: 78 },
      { metric: 'Branch coverage', before: 52, after: 65 },
      { metric: 'Function coverage', before: 58, after: 72 },
      { metric: 'Changed-files', before: 45, after: 82 },
    ],
    matrix,
    attention: {
      testTitle: 'Payment sheet on iPhone 15',
      kind: 'failed',
      reason: 'Test fails intermittently on iPhone 15 simulator. Passes on Pixel 7.',
      likelyCause: 'Apple Pay sheet animation exceeds default timeout on the simulator.',
      suggestedFix: 'Increase the payment-sheet wait or stub the native sheet on iOS.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    },
  },

  review: {
    testsAdded: 9,
    testsUpdated: 1,
    testsDeleted: 1,
    testsPassing: '10/11',
    coverage: { lineDelta: 14, branchDelta: 13 },
    flakyTracked: 0,
    filesChanged: [
      { path: 'src/services/coupon/coupon.test.ts', diffStat: '+42 −5', changeKind: 'update' },
      { path: 'src/services/coupon/coupon.ts', diffStat: '+3 −1', changeKind: 'update' },
      { path: 'src/routes/checkout/checkout.e2e.ts', diffStat: '+28', changeKind: 'add' },
      { path: 'tests/mobile/checkout.mobile.ts', diffStat: '+18', changeKind: 'add' },
      { path: 'src/services/payment/payment.test.ts', diffStat: '+8 −2', changeKind: 'update' },
      { path: 'src/middleware/auth/auth.test.ts', diffStat: '+5', changeKind: 'add' },
    ],
    remainingRisk: [
      { label: 'Pixel 7 retry timing', value: 'medium', sentiment: 'bad' },
      { label: 'Production code changes', value: 'medium', sentiment: 'bad' },
      { label: 'Open questions not answered', value: 'low', sentiment: 'neutral' },
      { label: 'Visual baselines need update', value: 'low', sentiment: 'neutral' },
    ],
    openQuestions: 2,
    recommendation: '10 of 11 tests pass. Coverage improved from 64% to 78%. 1 mobile test fails on iPhone 15.',
  },
};

const onboardingFeatureText = [
  'Feature: Guardrail onboarding',
  '',
  '  Scenario: Complete onboarding with local repository and optional knowledge sources',
  '    Given a developer opens Guardrail onboarding',
  '    When they select the local repository and continue',
  '    Then the initial scan starts and onboarding progress is visible',
].join('\n');

const onboardingChange: GeneratedChange = {
  id: 'ui-browser-onboarding',
  action: 'Add',
  testType: 'UI / Browser',
  title: 'Complete onboarding with selected repository',
  file: 'guardrail-tests/ui/onboarding.feature',
  feature: 'Onboarding',
  risk: 'High',
  reason: 'Adds browser-level evidence for repository selection and initial scan progress.',
  diff: onboardingFeatureText.split('\n').map(line => ({ kind: 'add', text: line })),
  status: 'staged',
};

const onboardingMatrix: TestResultRow[] = [
  {
    title: 'Complete onboarding with selected repository',
    type: 'UI / Browser',
    status: 'Passed',
    duration: '6.1s',
    evidence: 'screenshot',
    file: onboardingChange.file,
  },
];

const uiBrowserMockWorkbench: WorkbenchSession = {
  id: 'WB-UI-001',
  repo: guardrailRepo,
  createdAt: new Date().toISOString(),
  steps: { intent: 'active', isolation: 'locked', plan: 'locked', generate: 'locked', run: 'locked', review: 'locked' },

  intent: {
    prompt: 'Improve onboarding UI test coverage',
    feature: 'Onboarding',
    testTypes: ['UI / Browser'],
    sources: ['Codebase', 'QC test cases'],
  },

  isolation: {
    target: { feature: 'Onboarding', repo: guardrailRepo },
    sourceFiles: [
      { path: 'frontend/src/pages/OnboardingPage.tsx', kind: 'source', meta: 'Primary onboarding flow page for selected repository setup.' },
      { path: 'frontend/src/data/onboardingMockData.ts', kind: 'source', meta: 'Mock onboarding data used by the hackathon slice.' },
      { path: 'frontend/src/pages/GenerateTestsPage.tsx', kind: 'source', meta: 'Generate/improve tests page connected to the workbench experience.' },
      { path: 'frontend/src/data/workbench-api.ts', kind: 'source', meta: 'Frontend workbench API data adapter.' },
    ],
    existingTestFiles: [],
    specDocs: [],
    qcCases: [
      {
        id: 'QC-ONB-001',
        feature: 'Onboarding',
        scenario: 'Complete onboarding with local repository and optional knowledge sources',
        expectedResult: 'Repository scan starts and progress is visible to the user.',
        priority: 'High',
        automationStatus: 'missing',
      },
    ],
    currentCoverage: { line: 0, branch: 0 },
    currentStatus: { failed: 0, suspicious: 0, missing: 1, flaky: 0 },
    userJourneys: ['Complete onboarding with selected repository'],
    classifications: [
      {
        behavior: 'Complete onboarding with selected repository',
        status: 'Missing',
        suggestedTypes: ['UI / Browser'],
        risk: 'High',
        explanation: 'The onboarding flow has real browser behavior, but no UI Browser evidence is captured yet.',
      },
    ],
  },

  plan: {
    proposedActions: [{ action: 'add', label: 'Add UI Browser onboarding test', count: 1 }],
    risk: {
      productionCodeChanges: 'none',
      testDataChanges: false,
      browserAutomationRequired: true,
      mobileSimulatorRequired: 'no',
      externalApiMocking: 'no',
    },
    filesToChange: [onboardingChange.file],
    questions: [],
  },

  generation: {
    timeline: [
      { label: 'Load onboarding repository context', status: 'done' },
      { label: 'Draft UI Browser onboarding scenario', status: 'done' },
      { label: 'Stage generated feature payload', status: 'done' },
    ],
    changes: [onboardingChange],
    beforeAfter: {
      before: ['Onboarding has no UI Browser automation evidence.'],
      after: ['One UI Browser onboarding feature is staged for review.'],
    },
  },

  run: {
    unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
    ui: {
      command: 'agent-browser open http://127.0.0.1:5176/onboarding',
      browser: 'Chromium',
      outcome: 'Passed',
      passed: 1,
      durationMs: 6100,
      evidence: [
        {
          kind: 'screenshot',
          label: 'Onboarding screenshot',
          href: 'https://placehold.co/960x540/111827/818cf8?text=Onboarding+UI+Evidence',
        },
      ],
    },
    mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    coverage: [
      { metric: 'Line coverage', before: 0, after: 0 },
      { metric: 'Branch coverage', before: 0, after: 0 },
    ],
    matrix: onboardingMatrix,
  },

  review: {
    testsAdded: 1,
    testsUpdated: 0,
    testsDeleted: 0,
    testsPassing: '1/1',
    coverage: { lineDelta: 0, branchDelta: 0 },
    flakyTracked: 0,
    filesChanged: [{ path: onboardingChange.file, diffStat: '+6', changeKind: 'add' }],
    remainingRisk: [
      {
        label: 'Persistence',
        value: 'Generated UI Browser payload is staged only; persistence is outside this hackathon slice.',
        sentiment: 'neutral',
      },
    ],
    openQuestions: 0,
    recommendation: 'Review the captured onboarding evidence before enabling persistence.',
  },
};

export function mockWorkbenchForIntent(intent: Partial<IntentInput> = {}): WorkbenchSession {
  const mergedIntent = { ...mockWorkbench.intent, ...intent };
  const wantsUiBrowser = mergedIntent.testTypes?.includes('UI / Browser')
    || /ui|browser|onboarding/i.test(mergedIntent.prompt ?? '')
    || mergedIntent.feature === 'Onboarding';
  const inferredFeature = /onboarding/i.test(mergedIntent.prompt ?? '') ? 'Onboarding' : intent.feature;

  const base = structuredClone(wantsUiBrowser ? uiBrowserMockWorkbench : mockWorkbench);
  return {
    ...base,
    createdAt: new Date().toISOString(),
    intent: { ...base.intent, ...intent, ...(inferredFeature ? { feature: inferredFeature } : {}) },
  };
}
