import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGenerationScope } from './generation-scope.js';
import type { IsolationResult, TestPlan } from '../workbench.types.js';

const isolation: IsolationResult = {
  target: { feature: 'Checkout', repo: { name: 'acme', path: '/repo', branch: 'main' } },
  sourceFiles: [], existingTestFiles: [], specDocs: [], qcCases: [],
  currentCoverage: { line: 0, branch: 0 }, currentStatus: { failed: 0, suspicious: 0, missing: 2 },
  userJourneys: [],
  classifications: [
    { behavior: 'Apply coupon at checkout', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'Missing' },
    { behavior: 'Show payment errors', status: 'Weak', suggestedTypes: ['UI / Browser'], risk: 'Medium', explanation: 'Weak' },
    { behavior: 'Unit-only helper', status: 'Missing', suggestedTypes: ['Unit'], risk: 'Low', explanation: 'Not UI' },
  ],
};

const plan: TestPlan = {
  proposedActions: [
    { action: 'add', label: 'Add tests for 1 missing behaviors', count: 1 },
    { action: 'update', label: 'Strengthen 1 weak tests', count: 1 },
  ],
  risk: { productionCodeChanges: 'none', testDataChanges: false, browserAutomationRequired: true, mobileSimulatorRequired: 'no', externalApiMocking: 'optional' },
  filesToChange: ['guardrail-tests/ui/checkout.feature'],
  questions: [],
};

test('deriveGenerationScope maps approved plan actions to UI behaviors', () => {
  const scope = deriveGenerationScope(isolation, plan);
  assert.equal(scope.length, 2);
  assert.equal(scope[0]?.behavior, 'Apply coupon at checkout');
  assert.equal(scope[0]?.action, 'Add');
  assert.equal(scope[1]?.behavior, 'Show payment errors');
  assert.equal(scope[1]?.action, 'Update');
  assert.ok(scope.every(item => item.file.includes('guardrail-tests/ui/')));
});

test('deriveGenerationScope excludes non UI classifications', () => {
  const scope = deriveGenerationScope(isolation, plan);
  assert.ok(scope.every(item => item.behavior !== 'Unit-only helper'));
});
