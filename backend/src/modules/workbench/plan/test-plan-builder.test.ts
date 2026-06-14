import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestPlan } from './test-plan-builder.js';
import type { IntentInput, IsolationResult } from '../workbench.types.js';

const intent: IntentInput = {
  prompt: 'Add UI tests for checkout',
  feature: 'Checkout',
  testTypes: ['UI / Browser'],
  sources: ['Codebase'],
};

const isolation: IsolationResult = {
  target: { feature: 'Checkout', repo: { name: 'acme', path: '/repo', branch: 'main' } },
  sourceFiles: [{ path: 'src/pages/CheckoutPage.tsx', kind: 'source' }],
  existingTestFiles: [],
  specDocs: [],
  qcCases: [],
  currentCoverage: { line: 40, branch: 35 },
  currentStatus: { failed: 1, suspicious: 0, missing: 2 },
  userJourneys: ['Open CheckoutPage page'],
  classifications: [
    { behavior: 'Apply coupon at checkout', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'No browser test.' },
    { behavior: 'Show payment errors', status: 'Weak', suggestedTypes: ['UI / Browser'], risk: 'Medium', explanation: 'Assertions are shallow.' },
  ],
};

test('buildTestPlan derives actions risk and files from isolation', () => {
  const plan = buildTestPlan(intent, isolation);

  assert.equal(plan.proposedActions.length, 2);
  assert.equal(plan.proposedActions[0]?.action, 'add');
  assert.deepEqual(plan.proposedActions[0]?.items, ['Apply coupon at checkout']);
  assert.deepEqual(plan.proposedActions[1]?.items, ['Show payment errors']);
  assert.equal(plan.risk.browserAutomationRequired, true);
  assert.equal(plan.risk.productionCodeChanges, 'none');
  assert.ok(plan.filesToChange[0]?.includes('checkout'));
  assert.deepEqual(plan.questions, []);
  assert.equal(plan.runConstraints?.length, 2);
});

test('buildTestPlan merges optional model questions', () => {
  const plan = buildTestPlan(intent, isolation, [{
    id: 'q1',
    question: 'Should coupon tests use a mocked API?',
    options: ['Yes', 'No'],
  }]);

  assert.equal(plan.questions.length, 1);
  assert.equal(plan.questions[0]?.id, 'q1');
});
