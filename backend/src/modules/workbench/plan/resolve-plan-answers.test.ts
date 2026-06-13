import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlanAnswers } from './resolve-plan-answers.js';
import type { PlanApproval, TestPlan } from '../workbench.types.js';

const plan: TestPlan = {
  proposedActions: [],
  risk: {
    productionCodeChanges: 'none', testDataChanges: false, browserAutomationRequired: true,
    mobileSimulatorRequired: 'no', externalApiMocking: 'optional',
  },
  filesToChange: [],
  questions: [{
    id: 'coupon-apply-conflict',
    question: 'Auto-apply or manual apply?',
    options: ['Auto-apply on cart load', 'Manual apply via button'],
  }],
};

test('resolvePlanAnswers maps numeric indices to selected option text', () => {
  const approval: PlanApproval = { decision: 'approve', answers: { 'coupon-apply-conflict': 1 } };
  const resolved = resolvePlanAnswers(plan, approval);
  assert.deepEqual(resolved, [{
    questionId: 'coupon-apply-conflict',
    question: 'Auto-apply or manual apply?',
    selectedOption: 'Manual apply via button',
    selectedIndex: 1,
  }]);
});

test('resolvePlanAnswers skips unanswered questions', () => {
  const approval: PlanApproval = { decision: 'approve', answers: {} };
  assert.deepEqual(resolvePlanAnswers(plan, approval), []);
});
