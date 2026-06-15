import type {
  WorkbenchSession,
  IntentInput,
  IsolationResult,
  TestPlan,
  GenerationResult,
  TestRunResult,
  ReviewSummary,
} from '@/types/testlens';
import type { JobEvent, JobStep } from './workbench-api';

/**
 * Dev-only mock for the workbench flow, toggled by `?mock=1` in the URL. Returns instant canned data
 * (no backend, no model calls) so the UI and export can be verified quickly. Covers every render
 * branch: a passing test, a failing test with likely-cause/fix, a flaky test, and a skipped test.
 * This is never the real path — production behavior is unchanged when the flag is absent.
 */

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mock') === '1';
}

const MOCK_REPO = { name: 'ecommerce_test_project', path: '/mock/ecommerce_test_project', branch: 'main', commit: 'mockc0mmit' };

const MOCK_INTENT: IntentInput = {
  prompt: 'Improve UI coverage for the checkout and cart flows.',
  feature: 'Checkout',
  testTypes: ['UI / Browser'],
  sources: [],
};

/** Emit a few fast progress events so the step animations still play, then resolve. */
async function streamMock(onEvent: ((event: JobEvent) => void) | undefined, step: JobStep, messages: string[]): Promise<void> {
  if (!onEvent) return;
  for (let i = 0; i < messages.length; i += 1) {
    onEvent({ type: 'progress', jobId: 'mock', step, message: messages[i], percent: Math.round(((i + 1) / messages.length) * 100) });
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}

export function mockSession(): WorkbenchSession {
  return {
    id: 'mock-session',
    repo: MOCK_REPO,
    createdAt: new Date().toISOString(),
    steps: { intent: 'done', isolation: 'locked', plan: 'locked', generate: 'locked', run: 'locked', review: 'locked' },
    intent: MOCK_INTENT,
  };
}

export function mockIsolation(): IsolationResult {
  return {
    target: { feature: 'Checkout', repo: MOCK_REPO },
    sourceFiles: [
      { path: 'src/pages/CheckoutPage.tsx', kind: 'source', meta: '210 LOC' },
      { path: 'src/store/cartStore.ts', kind: 'source', meta: '115 LOC' },
    ],
    existingTestFiles: [{ path: 'src/test/cartLogic.test.ts', kind: 'test', meta: '6 tests' }],
    specDocs: [],
    qcCases: [],
    currentCoverage: { line: 2, branch: 0 },
    currentStatus: { failed: 0, suspicious: 2, missing: 5, flaky: 0 },
    userJourneys: ['Browse → Add to cart → Checkout', 'Open modal → Escape to close'],
    classifications: [
      { behavior: 'Checkout form validation', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'Critical', explanation: 'No test covers email/phone validation on the checkout form.' },
      { behavior: 'Modal escape key', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'Medium', explanation: 'Modal close-on-Escape is unverified.' },
    ],
  };
}

export function mockPlan(): TestPlan {
  return {
    proposedActions: [
      { action: 'add', label: 'Add tests for 4 behaviors', count: 4, items: ['Checkout form validation', 'Modal escape key', 'Add-to-cart updates count', 'Route mapping'] },
    ],
    risk: {
      productionCodeChanges: 'none',
      testDataChanges: false,
      browserAutomationRequired: true,
      mobileSimulatorRequired: 'no',
      externalApiMocking: 'no',
    },
    filesToChange: [
      'src/test/checkout-form-validation.feature',
      'src/test/modal-escape-key.feature',
      'src/test/add-to-cart-updates-count.feature',
      'src/test/route-mapping.feature',
    ],
    questions: [],
  };
}

export function mockGeneration(): GenerationResult {
  const diff = (text: string) => [{ kind: 'add' as const, text }];
  return {
    timeline: [
      { label: 'Reading product context', status: 'done' },
      { label: 'Drafting Gherkin scenarios', status: 'done' },
      { label: 'Staging feature files', status: 'done' },
    ],
    changes: [
      { id: 'c1', action: 'Add', testType: 'UI / Browser', title: 'Modal closes when Escape key is pressed', file: 'src/test/modal-escape-key.feature', feature: 'Modal', risk: 'Medium', reason: 'Verify modal closes on Escape.', diff: diff('Feature: Modal escape key'), status: 'staged' },
      { id: 'c2', action: 'Add', testType: 'UI / Browser', title: 'Checkout form validation (email & phone)', file: 'src/test/checkout-form-validation.feature', feature: 'Checkout', risk: 'Critical', reason: 'Verify invalid email/phone is rejected.', diff: diff('Feature: Checkout form validation'), status: 'staged' },
      { id: 'c3', action: 'Add', testType: 'UI / Browser', title: 'Add to cart updates count', file: 'src/test/add-to-cart-updates-count.feature', feature: 'Cart', risk: 'High', reason: 'Verify cart count increments.', diff: diff('Feature: Add to cart'), status: 'staged' },
      { id: 'c4', action: 'Add', testType: 'UI / Browser', title: 'Route mapping renders correct pages', file: 'src/test/route-mapping.feature', feature: 'Routing', risk: 'Medium', reason: 'Verify routes map to pages.', diff: diff('Feature: Route mapping'), status: 'staged' },
    ],
    beforeAfter: { before: ['0 UI tests'], after: ['4 UI tests staged'] },
  };
}

export function mockRun(): TestRunResult {
  return {
    unit: { command: 'npm test', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
    ui: {
      command: 'agent-browser open http://127.0.0.1:5173/',
      browser: 'Chromium',
      outcome: 'Failed',
      passed: 1,
      durationMs: 64000,
      evidence: [{ kind: 'screenshot', label: 'Modal closed — page scrollable', href: undefined }],
    },
    mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    coverage: [
      { metric: 'Line coverage', before: 2, after: 9 },
      { metric: 'Branch coverage', before: 0, after: 5 },
    ],
    matrix: [
      { title: 'Modal closes when Escape key is pressed', type: 'UI / Browser', status: 'Passed', duration: '64s', evidence: 'screenshot', reason: null, file: 'src/test/modal-escape-key.feature' },
      { title: 'Checkout form validation (email & phone)', type: 'UI / Browser', status: 'Failed', duration: '12s', evidence: null, reason: 'Expected validation error for "abc@" but the form submitted successfully.', file: 'src/test/checkout-form-validation.feature' },
      { title: 'Add to cart updates count', type: 'UI / Browser', status: 'Flaky', duration: '18s', evidence: null, reason: 'Cart count updated on retry 2/3 — intermittent race on the store update.', file: 'src/test/add-to-cart-updates-count.feature' },
      { title: 'Route mapping renders correct pages', type: 'UI / Browser', status: 'Skipped', duration: null, evidence: null, reason: 'Skipped: depends on the checkout flow which failed earlier.', file: 'src/test/route-mapping.feature' },
    ],
    attention: {
      testTitle: 'Checkout form validation (email & phone)',
      kind: 'failed',
      reason: 'Expected validation error for "abc@" but the form submitted successfully.',
      likelyCause: 'CheckoutPage email regex accepts strings without a TLD, so invalid input passes.',
      suggestedFix: 'Tighten the email pattern in CheckoutPage.tsx to require a domain + TLD, then re-run.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    },
  };
}

export function mockReview(): ReviewSummary {
  return {
    testsAdded: 4,
    testsUpdated: 0,
    testsDeleted: 0,
    testsPassing: '1/4',
    coverage: { lineDelta: 7, branchDelta: 5 },
    flakyTracked: 1,
    filesChanged: [
      { path: 'src/test/modal-escape-key.feature', diffStat: '+1', changeKind: 'add' },
      { path: 'src/test/checkout-form-validation.feature', diffStat: '+1', changeKind: 'add' },
      { path: 'src/test/add-to-cart-updates-count.feature', diffStat: '+1', changeKind: 'add' },
      { path: 'src/test/route-mapping.feature', diffStat: '+1', changeKind: 'add' },
    ],
    failures: [
      { title: 'Checkout form validation (email & phone)', type: 'UI / Browser', kind: 'failed', reason: 'Expected validation error for "abc@" but the form submitted successfully.', file: 'src/test/checkout-form-validation.feature', likelyCause: 'CheckoutPage email regex accepts strings without a TLD.', suggestedFix: 'Tighten the email pattern in CheckoutPage.tsx to require a domain + TLD.' },
      { title: 'Add to cart updates count', type: 'UI / Browser', kind: 'flaky', reason: 'Cart count updated on retry 2/3 — intermittent race on the store update.', file: 'src/test/add-to-cart-updates-count.feature' },
    ],
    remainingRisk: [],
    openQuestions: 0,
    recommendation: 'Only 1 of 4 tests passed. Review the failing checkout validation and the flaky cart update before applying.',
  };
}

export const mockStream = streamMock;
