import test from 'node:test';
import assert from 'node:assert/strict';
import { UiBrowserAdapter } from './ui-browser.adapter.js';
import { LocalGuardrailRepositoryProvider } from '../../repositories/local-guardrail-repository-provider.js';
import type { AdapterInput } from '../test-type-adapter.js';
import type { WorkbenchSession } from '../../workbench.types.js';

test('ui browser adapter returns schema-shaped fallback analyze plan generate run review results', async () => {
  const repo = await new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() }).getContext('mock');
  const adapter = new UiBrowserAdapter({ runner: { run: async () => ({ outcome: 'Passed', durationMs: 1000, evidence: [] }) } });
  const session: WorkbenchSession = {
    id: 'wb-test',
    repo: repo.repo,
    createdAt: '2026-06-12T00:00:00.000Z',
    steps: { intent: 'done', isolation: 'active', plan: 'locked', generate: 'locked', run: 'locked', review: 'locked' },
    intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] },
  };

  const events: string[] = [];
  const input: AdapterInput = { session, repository: repo, emit: event => events.push(event.type), modelConnect: null, signal: new AbortController().signal };
  const isolation = await adapter.analyze(input);
  const plan = await adapter.plan({ ...input, isolation });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });
  const run = await adapter.run({ ...input, generation });
  const review = await adapter.review({ ...input, generation, run });

  assert.equal(isolation.classifications[0]?.suggestedTypes[0], 'UI / Browser');
  assert.equal(plan.risk.browserAutomationRequired, true);
  assert.equal(generation.changes[0]?.file, 'guardrail-tests/ui/onboarding.feature');
  assert.equal(run.ui.outcome, 'Passed');
  assert.equal(review.testsAdded, 1);
  assert.ok(events.includes('progress'));
});
