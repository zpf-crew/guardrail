import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsolationContext } from './isolation-context.js';
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

const intent = { prompt: 'Add UI tests for checkout coupon apply' };

test('buildIsolationContext exposes guardrail UI test design and classification policy', () => {
  const context = buildIsolationContext(intent, repository);

  assert.equal(context.guardrailUiTestDesign.runner, 'agent-browser');
  assert.equal(context.guardrailUiTestDesign.transientUiPolicy.rule, 'Treat transient UI feedback as supporting evidence only, not the primary behavior or required assertion.');
  assert.equal(context.classificationPolicy.onePerDistinctBehavior, true);
  assert.equal(context.classificationPolicy.transientUiAsSupportingEvidenceOnly, true);
  assert.equal(context.classificationPolicy.preferDurableStateOverTransientFeedback, true);
  assert.equal(context.schemaName, 'IsolationClassifications');
  assert.equal(context.intent, intent);
  assert.equal(context.repository.repo.name, 'acme');
  assert.equal(context.onboarding, repository.onboarding);
});
