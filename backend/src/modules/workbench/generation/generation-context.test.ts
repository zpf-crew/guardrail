import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationContext } from './generation-context.js';
import type { IsolationResult, PlanApproval, TestPlan } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

const isolation: IsolationResult = {
  target: { feature: 'Checkout', repo: { name: 'acme', path: '/repo', branch: 'main' } },
  sourceFiles: [], existingTestFiles: [], specDocs: [], qcCases: [],
  currentCoverage: { line: 0, branch: 0 }, currentStatus: { failed: 0, suspicious: 0, missing: 1 },
  userJourneys: [],
  classifications: [
    { behavior: 'Apply coupon at checkout', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'Missing' },
  ],
};

const plan: TestPlan = {
  proposedActions: [{ action: 'add', label: 'Add tests for 1 missing behaviors', count: 1 }],
  risk: {
    productionCodeChanges: 'none', testDataChanges: false, browserAutomationRequired: true,
    mobileSimulatorRequired: 'no', externalApiMocking: 'optional',
  },
  filesToChange: ['guardrail-tests/ui/checkout.feature'],
  questions: [{
    id: 'coupon-apply-conflict',
    question: 'Auto-apply or manual apply?',
    options: ['Auto-apply on cart load', 'Manual apply via button'],
  }],
};

const repository: RepositoryContext = {
  repo: { name: 'acme', path: '/repo', branch: 'main' },
  relatedFiles: [],
  specDocs: [],
  qcCases: [],
  sourceSnippets: [],
  onboarding: { lastScanAt: null, health: null, coverage: null, testCases: [], insights: [] },
};

const intent = { prompt: 'Add UI tests for coupon apply at checkout' };

test('buildGenerationContext includes resolvedPlanAnswers when approval has answer', () => {
  const approval: PlanApproval = { decision: 'approve', answers: { 'coupon-apply-conflict': 1 } };
  const context = buildGenerationContext(isolation, plan, repository, intent, approval);

  assert.equal(context.resolvedPlanAnswers.length, 1);
  assert.equal(context.resolvedPlanAnswers[0]?.selectedOption, 'Manual apply via button');
  assert.equal(context.generationPolicy.honorResolvedPlanAnswers, true);
});

test('buildGenerationContext has empty resolvedPlanAnswers when unanswered', () => {
  const approval: PlanApproval = { decision: 'approve', answers: {} };
  const context = buildGenerationContext(isolation, plan, repository, intent, approval);

  assert.deepEqual(context.resolvedPlanAnswers, []);
});
