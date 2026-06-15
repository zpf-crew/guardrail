import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnitGenerationContext } from './unit-context.js';
import type { IsolationResult, TestPlan } from '../../workbench.types.js';
import type { RepositoryContext } from '../../repositories/repository-context-provider.js';

test('unit generation context keeps one behavior and excludes unrelated large snippets', () => {
  const isolation = {
    target: { feature: 'Cart', repo: { name: 'shop', path: '/tmp/shop', branch: 'main' } },
    sourceFiles: [{ path: 'src/cart.ts', kind: 'source' }],
    existingTestFiles: [],
    specDocs: [],
    qcCases: [],
    currentCoverage: { line: 0, branch: 0 },
    currentStatus: { failed: 0, suspicious: 0, missing: 2 },
    userJourneys: [],
    classifications: [
      {
        behavior: 'Cart totals include item quantity',
        status: 'Missing',
        suggestedTypes: ['Unit'],
        risk: 'High',
        explanation: 'Missing total test.',
      },
      {
        behavior: 'Checkout submits an order',
        status: 'Missing',
        suggestedTypes: ['Unit'],
        risk: 'High',
        explanation: 'Missing checkout test.',
      },
    ],
  } satisfies IsolationResult;
  const plan = {
    proposedActions: [{ action: 'add', label: 'Add missing unit tests', count: 2 }],
    risk: {
      productionCodeChanges: 'none',
      testDataChanges: false,
      browserAutomationRequired: false,
      mobileSimulatorRequired: 'no',
      externalApiMocking: 'no',
    },
    filesToChange: ['src/cart.test.ts'],
    questions: [],
  } satisfies TestPlan;
  const repository = {
    repo: isolation.target.repo,
    relatedFiles: [{ path: 'src/cart.ts', kind: 'source' }, { path: 'src/checkout.ts', kind: 'source' }],
    specDocs: [],
    qcCases: [],
    sourceSnippets: [
      { path: 'src/cart.ts', startLine: 1, endLine: 3, summary: 'Cart total logic', text: 'export function calculateCartTotal() { return 10; }' },
      { path: 'src/checkout.ts', startLine: 1, endLine: 3000, summary: 'Checkout logic', text: 'x'.repeat(40_000) },
    ],
    onboarding: {
      lastScanAt: null,
      health: null,
      coverage: null,
      testCases: Array.from({ length: 500 }, (_, index) => ({
        id: String(index),
        title: `Unrelated ${index}`,
        status: 'missing',
        type: 'Unit',
        feature: 'Checkout',
        risk: 'Low',
      })),
      insights: [],
    },
  } satisfies RepositoryContext;

  const context = buildUnitGenerationContext(
    isolation,
    plan,
    repository,
    { prompt: 'Improve cart totals' },
    { decision: 'approve', answers: {} },
    [{
      behavior: 'Cart totals include item quantity',
      action: 'Add',
      risk: 'High',
      file: 'src/cart.test.ts',
    }],
    'vitest',
  );

  assert.deepEqual(context.isolation.classifications.map(item => item.behavior), ['Cart totals include item quantity']);
  assert.deepEqual(context.repository.sourceSnippets.map(item => item.path), ['src/cart.ts']);
  assert.ok(JSON.stringify(context).length < 10_000);
});
