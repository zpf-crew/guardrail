import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsolationResult } from './isolation-result-builder.js';
import type { IntentInput } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

const intent: IntentInput = {
  prompt: 'Improve onboarding UI tests',
  feature: 'Onboarding',
  testTypes: ['UI / Browser'],
  sources: ['Codebase'],
};

const repository: RepositoryContext = {
  repo: { name: 'guardrail', path: '/repo', branch: 'main' },
  relatedFiles: [
    { path: 'frontend/src/pages/OnboardingPage.tsx', kind: 'source' },
    { path: 'frontend/src/pages/OnboardingPage.test.tsx', kind: 'test' },
  ],
  specDocs: [{ path: 'docs/onboarding.md', kind: 'spec' }],
  qcCases: [],
  sourceSnippets: [],
  onboarding: {
    lastScanAt: '2026-06-12T00:00:00.000Z',
    health: { score: 72, grade: 'B' },
    coverage: 61,
    testCases: [
      { id: '1', title: 'Onboarding flow', status: 'missing', type: 'UI / Browser', feature: 'Onboarding', risk: 'High' },
      { id: '2', title: 'Login', status: 'failed', type: 'Unit', feature: 'Auth', risk: 'Medium' },
    ],
    insights: [{ id: 'ins-1', title: 'Missing onboarding UI coverage', severity: 'High', description: 'No browser test' }],
  },
};

test('buildIsolationResult fills deterministic fields from repository scan', () => {
  const result = buildIsolationResult(intent, repository, [{
    behavior: 'Complete onboarding',
    status: 'Missing',
    suggestedTypes: ['UI / Browser'],
    risk: 'High',
    explanation: 'No browser evidence found.',
  }]);

  assert.equal(result.target.feature, 'Onboarding');
  assert.equal(result.sourceFiles[0]?.path, 'frontend/src/pages/OnboardingPage.tsx');
  assert.equal(result.existingTestFiles[0]?.path, 'frontend/src/pages/OnboardingPage.test.tsx');
  assert.equal(result.currentCoverage.line, 61);
  assert.equal(result.currentStatus.missing, 1);
  assert.equal(result.currentStatus.failed, 1);
  assert.ok(result.userJourneys.some(journey => journey.includes('OnboardingPage')));
  assert.equal(result.classifications.length, 1);
});

test('buildIsolationResult falls back when model classifications are empty', () => {
  const result = buildIsolationResult(intent, repository, []);
  assert.equal(result.classifications.length, 1);
  assert.match(result.classifications[0]?.explanation ?? '', /Repository scan found/);
});
