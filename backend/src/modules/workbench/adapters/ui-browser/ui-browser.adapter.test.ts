import test from 'node:test';
import assert from 'node:assert/strict';
import { UiBrowserAdapter } from './ui-browser.adapter.js';
import { LocalGuardrailRepositoryProvider } from '../../repositories/local-guardrail-repository-provider.js';
import type { AdapterInput } from '../test-type-adapter.js';
import type { WorkbenchSession, TestPlan } from '../../workbench.types.js';

async function buildInput(overrides: Partial<AdapterInput> = {}): Promise<AdapterInput> {
  const repo = await new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() }).getContext('mock');
  const session: WorkbenchSession = {
    id: 'wb-test',
    repo: repo.repo,
    createdAt: '2026-06-12T00:00:00.000Z',
    steps: { intent: 'done', isolation: 'active', plan: 'locked', generate: 'locked', run: 'locked', review: 'locked' },
    intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] },
  };

  return {
    session,
    repository: repo,
    emit: () => undefined,
    modelConnect: null,
    signal: new AbortController().signal,
    ...overrides,
  };
}

const plan: TestPlan = {
  proposedActions: [{ action: 'add', label: 'Add UI Browser onboarding test', count: 1 }],
  risk: {
    productionCodeChanges: 'none',
    testDataChanges: false,
    browserAutomationRequired: true,
    mobileSimulatorRequired: 'no',
    externalApiMocking: 'no',
  },
  filesToChange: ['guardrail-tests/ui/onboarding.feature'],
  questions: [],
};

test('ui browser adapter returns schema-shaped fallback analyze plan generate run review results', async () => {
  const adapter = new UiBrowserAdapter({ runner: { run: async () => ({ outcome: 'Passed', durationMs: 1000, evidence: [] }) } });
  const events: string[] = [];
  const input = await buildInput({ emit: event => events.push(event.type) });
  const isolation = await adapter.analyze(input);
  const testPlan = await adapter.plan({ ...input, isolation });
  const generation = await adapter.generate({ ...input, plan: testPlan, approval: { decision: 'approve', answers: {} } });
  const run = await adapter.run({ ...input, generation });
  const review = await adapter.review({ ...input, generation, run });

  assert.equal(isolation.classifications[0]?.suggestedTypes[0], 'UI / Browser');
  assert.equal(testPlan.risk.browserAutomationRequired, true);
  assert.equal(generation.changes[0]?.file, 'guardrail-tests/ui/onboarding.feature');
  assert.equal(run.ui.outcome, 'Passed');
  assert.equal(review.testsAdded, 1);
  assert.ok(events.includes('progress'));
});

test('ui browser adapter generate returns no-op changes when ui tests are skipped', async () => {
  const adapter = new UiBrowserAdapter();
  const input = await buildInput();

  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'approve', skipUiTests: true, answers: {} },
  });

  assert.deepEqual(generation.changes, []);
  assert.match(generation.beforeAfter.after[0] ?? '', /skipped/i);
});

test('ui browser adapter generate returns no-op changes for unit-tests-only approval', async () => {
  const adapter = new UiBrowserAdapter();
  const input = await buildInput();

  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'approve', unitTestsOnly: true, answers: {} },
  });

  assert.deepEqual(generation.changes, []);
  assert.match(generation.timeline[0]?.label ?? '', /unit/i);
});

test('ui browser adapter propagates runner abort rejection', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const adapter = new UiBrowserAdapter({ runner: { run: async () => { throw abortError; } } });
  const input = await buildInput();
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  await assert.rejects(adapter.run({ ...input, generation }), abortError);
});

test('ui browser adapter propagates model abort rejection', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const modelConnect = {
    getCoder: () => ({ chat: async () => { throw abortError; } }),
  } as unknown as AdapterInput['modelConnect'];
  const adapter = new UiBrowserAdapter();
  const input = await buildInput({ modelConnect });

  await assert.rejects(
    adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } }),
    abortError,
  );
});

test('ui browser adapter returns attention for flaky runner results', async () => {
  const adapter = new UiBrowserAdapter({ runner: { run: async () => ({ outcome: 'Flaky', durationMs: 1500, evidence: [] }) } });
  const input = await buildInput();
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.outcome, 'Flaky');
  assert.equal(run.attention?.kind, 'flaky');
});

test('ui browser adapter isolation does not alias repository context objects', async () => {
  const adapter = new UiBrowserAdapter();
  const input = await buildInput();
  const isolation = await adapter.analyze(input);

  isolation.target.repo.name = 'mutated';
  isolation.qcCases[0]!.scenario = 'mutated';

  assert.equal(input.repository.repo.name, 'guardrail');
  assert.equal(input.repository.qcCases[0]?.scenario, 'Complete onboarding with local repository and optional knowledge sources');
});

test('ui browser adapter returns skipped fallback with explicit no-op runner', async () => {
  const adapter = new UiBrowserAdapter({
    runner: { run: async () => ({ outcome: 'Skipped', durationMs: 0, evidence: [] }) },
  });
  const input = await buildInput();
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.outcome, 'Skipped');
  assert.equal(run.ui.command, `agent-browser open ${input.repository.frontend.url}`);
  assert.ok(run.ui.evidence.length > 0);
});

test('ui browser adapter returns failed result for non-abort runner failure', async () => {
  const adapter = new UiBrowserAdapter({ runner: { run: async () => { throw new Error('browser unavailable'); } } });
  const input = await buildInput();
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.outcome, 'Failed');
  assert.equal(run.attention?.kind, 'failed');
  assert.match(run.attention?.reason ?? '', /browser unavailable/);
});

test('ui browser adapter does not call runner after no-op generation', async () => {
  let runnerCalled = false;
  const adapter = new UiBrowserAdapter({
    runner: {
      run: async () => {
        runnerCalled = true;
        return { outcome: 'Passed', durationMs: 1000, evidence: [] };
      },
    },
  });
  const input = await buildInput();
  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'approve', skipUiTests: true, answers: {} },
  });

  const run = await adapter.run({ ...input, generation });
  const review = await adapter.review({ ...input, generation, run });

  assert.equal(runnerCalled, false);
  assert.equal(run.ui.outcome, 'Skipped');
  assert.equal(run.matrix[0]?.status, 'Skipped');
  assert.equal(review.testsAdded, 0);
  assert.equal(review.testsPassing, '0/0');
});
