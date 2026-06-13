import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkbenchStepResult, validateUiBrowserRunPlan } from './workbench-validators.js';

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
  });

  assert.equal(result.questions[0]?.id, 'coupon-api');
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

test('validates ui browser run plan', () => {
  const result = validateUiBrowserRunPlan({
    scenarioTitle: 'Complete onboarding',
    actions: [
      { kind: 'open', path: '/onboarding' },
      { kind: 'waitForLoad', state: 'networkidle' },
      { kind: 'screenshot', label: 'Onboarding loaded' },
      { kind: 'click', role: 'button', name: 'Continue' },
      { kind: 'assertText', text: 'Scan' },
    ],
  });

  assert.equal(result.actions.length, 5);
});
