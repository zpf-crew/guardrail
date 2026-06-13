import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  WorkbenchSession,
  TestRunResult,
  ReviewSummary,
  QuickAction,
  ReviewDecision,
} from './workbench.types.js';

test('workbench schema mirror accepts the shared frontend workbench shapes', () => {
  const session: WorkbenchSession = {
    id: 'wb-local-1',
    repoId: 'guardrail',
    userId: 'user-1',
    repo: { name: 'guardrail', path: '/repo', branch: 'main', commit: 'abc123' },
    createdAt: '2026-06-12T00:00:00.000Z',
    steps: {
      intent: 'active',
      isolation: 'locked',
      plan: 'locked',
      generate: 'locked',
      run: 'locked',
      review: 'locked',
    },
    intent: {
      prompt: 'Test onboarding',
      feature: 'Checkout',
      testTypes: ['UI / Browser'],
      sources: ['Codebase', 'QC test cases'],
    },
  };

  const run: TestRunResult = {
    unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
    ui: {
      command: 'agent-browser open http://localhost:5173/onboarding',
      browser: 'Chromium',
      outcome: 'Passed',
      passed: 1,
      durationMs: 1000,
      evidence: [{ kind: 'screenshot', label: 'Onboarding summary', href: '/artifacts/summary.png' }],
    },
    mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    coverage: [],
    matrix: [{ title: 'Onboarding flow', type: 'UI / Browser', status: 'Passed', duration: '1.0s', evidence: 'screenshot', reason: null, file: 'guardrail-tests/ui/onboarding.feature' }],
  };

  const review: ReviewSummary = {
    testsAdded: 1,
    testsUpdated: 0,
    testsDeleted: 0,
    testsPassing: '1/1',
    coverage: { lineDelta: 0, branchDelta: 0 },
    flakyTracked: 0,
    filesChanged: [{ path: 'guardrail-tests/ui/onboarding.feature', diffStat: '+12', changeKind: 'add' }],
    remainingRisk: [{ label: 'Persistence', value: 'Not implemented in this slice', sentiment: 'neutral' }],
    openQuestions: 0,
    recommendation: 'Review generated evidence before applying future changes.',
  };

  const quickAction: QuickAction = {
    id: 'qa-onboarding-ui',
    label: 'Generate onboarding UI browser test',
    feature: 'Checkout',
    severity: 'High',
    testTypes: ['UI / Browser'],
    sourceInsightId: 'insight-1',
  };

  const decision: ReviewDecision = { type: 'export-plan' };

  assert.equal(session.intent.testTypes[0], 'UI / Browser');
  assert.equal(run.ui.evidence[0]?.kind, 'screenshot');
  assert.equal(review.filesChanged[0]?.changeKind, 'add');
  assert.equal(quickAction.severity, 'High');
  assert.equal(decision.type, 'export-plan');
});
