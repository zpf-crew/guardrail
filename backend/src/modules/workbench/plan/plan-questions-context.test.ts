import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanQuestionsContext } from './plan-questions-context.js';
import type { IsolationResult } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

const repository: RepositoryContext = {
  repo: { name: 'acme', path: '/repo', branch: 'main' },
  frontend: { route: '/', url: 'http://localhost:5173/' },
  relatedFiles: [],
  specDocs: [],
  qcCases: [],
  sourceSnippets: [],
  onboarding: { lastScanAt: null, health: null, coverage: null, testCases: [], insights: [] },
};

const isolation: IsolationResult = {
  target: { feature: 'Cart', repo: repository.repo },
  sourceFiles: [],
  existingTestFiles: [],
  specDocs: [],
  qcCases: [],
  currentCoverage: { line: 0, branch: 0 },
  currentStatus: { failed: 0, suspicious: 0, missing: 1 },
  userJourneys: ['Open product page and add item to cart'],
  classifications: [{
    behavior: 'Cart reflects added item',
    status: 'Missing',
    suggestedTypes: ['UI / Browser'],
    risk: 'High',
    explanation: 'Durable cart state is not covered.',
  }],
};

test('buildPlanQuestionsContext exposes transient UI policy to question model', () => {
  const context = buildPlanQuestionsContext(isolation, repository, { prompt: 'Add cart UI tests' });

  assert.ok(context.guardrailUiTestDesign.transientUiPolicy.transientSignals.includes('toast'));
  assert.ok(context.guardrailUiTestDesign.transientUiPolicy.durableAlternatives.includes('cart count'));
  assert.ok(context.questionPolicy.neverAskAbout.some(item => /Transient toast/i.test(item)));
});
