import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkbenchStepResult,
  validateUiBrowserAgentAction,
  validateUnitRunPlan,
} from './workbench-validators.js';

test('validates isolation classifications shape', () => {
  const result = validateWorkbenchStepResult('IsolationClassifications', {
    classifications: [{
      behavior: 'Complete onboarding',
      status: 'Missing',
      suggestedTypes: ['UI / Browser'],
      risk: 'High',
      explanation: 'No UI Browser test was found in repository context.',
    }],
  });

  assert.equal(result.classifications[0]?.behavior, 'Complete onboarding');
});

test('validates test plan questions slice', () => {
  const result = validateWorkbenchStepResult('TestPlanQuestions', {
    questions: [{
      id: 'coupon-api',
      question: 'Should coupon tests mock the payment API?',
      options: ['Yes — mock API', 'No — use staging'],
    }],
    runConstraintOverrides: [{
      behavior: 'Apply coupon at checkout',
      maxStepDurationMs: 45_000,
      maxSteps: 20,
      reason: 'Coupon validation may take longer than a normal page interaction',
    }],
  });

  assert.equal(result.questions[0]?.id, 'coupon-api');
  assert.equal(result.runConstraintOverrides?.[0]?.maxStepDurationMs, 45_000);
});

test('validates isolation result shape', () => {
  const result = validateWorkbenchStepResult('IsolationResult', {
    target: { feature: 'Onboarding', repo: { name: 'guardrail', path: '/repo', branch: 'main' } },
    sourceFiles: [{ path: 'frontend/src/pages/OnboardingPage.tsx', kind: 'source' }],
    existingTestFiles: [],
    specDocs: [],
    qcCases: [],
    currentCoverage: { line: 0, branch: 0 },
    currentStatus: { failed: 0, suspicious: 0, missing: 1 },
    userJourneys: ['Complete onboarding'],
    classifications: [{
      behavior: 'Complete onboarding',
      status: 'Missing',
      suggestedTypes: ['UI / Browser'],
      risk: 'High',
      explanation: 'No UI Browser test was found in repository context.',
    }],
  });

  assert.equal(result.target.feature, 'Onboarding');
});

test('rejects invalid generation result shape', () => {
  assert.throws(
    () => validateWorkbenchStepResult('GenerationResult', { changes: 'not an array' }),
    /GenerationResult validation failed/,
  );
});

test('validates generated unit change content', () => {
  const result = validateWorkbenchStepResult('GenerationChanges', {
    changes: [{
      id: 'coupon-unit',
      action: 'Add',
      testType: 'Unit',
      title: 'Validate coupon expiry',
      file: 'src/coupon/coupon.test.ts',
      feature: 'Coupon',
      risk: 'High',
      reason: 'Missing unit coverage for expiry branch.',
      diff: [{ kind: 'add', text: "test('expiry', () => {})" }],
      content: "import test from 'node:test';\n",
      status: 'staged',
    }],
  });

  assert.equal(result.changes[0]?.content, "import test from 'node:test';\n");
});

test('validates unit run plan shape', () => {
  const result = validateUnitRunPlan({
    packageRoot: 'backend',
    generatedTestPath: 'src/coupon/coupon.test.ts',
    focused: true,
    setupNotes: ['Use existing node:test style'],
    expectedRunner: 'node:test',
  });

  assert.equal(result.expectedRunner, 'node:test');
});

test('validateUiBrowserAgentAction accepts click ref action', () => {
  const result = validateUiBrowserAgentAction({ kind: 'click', ref: '@e4' });
  assert.equal(result.kind, 'click');
  assert.equal(result.ref, '@e4');
test('validateUiBrowserAgentAction rejects legacy manual browser actions', () => {
  assert.throws(
    () => validateUiBrowserAgentAction({ kind: 'click', ref: '@e4' }),
    /UiBrowserAgentAction validation failed/,
  );
});

test('validateUiBrowserAgentAction accepts assertThen', () => {
  const result = validateUiBrowserAgentAction({
    kind: 'assertThen',
    stepIndex: 2,
    satisfied: false,
    reason: 'Products page not visible',
  });
  assert.equal(result.kind, 'assertThen');
  if (result.kind === 'assertThen') {
    assert.equal(result.satisfied, false);
  }
});

test('validateUiBrowserAgentAction accepts agentBrowserCommand', () => {
  const result = validateUiBrowserAgentAction({
    kind: 'agentBrowserCommand',
    command: 'find',
    args: ['role', 'button', 'click', 'Add to Cart'],
    reason: 'Click the product-card Add to Cart button by role and name',
  });
  assert.equal(result.kind, 'agentBrowserCommand');
  if (result.kind === 'agentBrowserCommand') {
    assert.equal(result.command, 'find');
    assert.deepEqual(result.args, ['role', 'button', 'click', 'Add to Cart']);
  }
});

test('validates UI Browser user flow plans', () => {
  const result = validateWorkbenchStepResult('UiBrowserUserFlowPlan', {
    behaviorTitle: 'Add product to cart from homepage',
    acceptedFlows: [
      {
        id: 'flow-1',
        title: 'Add one product to cart',
        sourceScenarioIndexes: [0, 1],
        userGoal: 'A shopper adds a product from the homepage to the cart.',
        durableOutcome: 'The cart count or cart contents show one item.',
        priority: 'high',
      },
    ],
    droppedScenarios: [
      {
        sourceScenarioIndex: 2,
        reason: 'Toast-only assertion is transient and covered by cart state.',
      },
    ],
  });

  assert.equal(result.acceptedFlows[0].id, 'flow-1');
  assert.equal(result.droppedScenarios[0].sourceScenarioIndex, 2);
});

test('validates UI Browser execution plans', () => {
  const result = validateWorkbenchStepResult('UiBrowserExecutionPlan', {
    flowId: 'flow-1',
    title: 'Add one product to cart',
    steps: [
      {
        id: 'step-1',
        kind: 'setup',
        instruction: 'Open the homepage.',
        successCriteria: 'The homepage is loaded.',
      },
      {
        id: 'step-2',
        kind: 'action',
        instruction: 'Find the first Add to Cart button, scrolling if needed, and click it.',
        successCriteria: 'The click completes.',
      },
      {
        id: 'step-3',
        kind: 'assert',
        instruction: 'Verify the cart reflects one added item.',
        successCriteria: 'The cart count or cart contents show one item.',
      },
    ],
  });

  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[2].kind, 'assert');
});
