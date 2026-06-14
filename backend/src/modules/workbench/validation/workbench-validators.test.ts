import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkbenchStepResult,
  validateUiBrowserAgentAction,
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
