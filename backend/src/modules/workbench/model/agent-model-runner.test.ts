import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentModelRunner } from './agent-model-runner.js';

function fakeModelConnect(response: { content: string }) {
  return {
    getClient: () => ({
      chat: async () => response,
    }),
  } as never;
}

test('decideNext validates model JSON into UiBrowserAgentAction', async () => {
  const runner = new AgentModelRunner({
    modelConnect: fakeModelConnect({ content: '{"kind":"click","ref":"@e2"}' }),
  });

  const action = await runner.decideNext({
    profile: 'coder',
    skill: { name: 'test-run-ui-browser-agent', content: 'rules' },
    context: {
      scenarioTitle: 'Shop now',
      gherkinSteps: [],
      currentStepIndex: 1,
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '',
      actionHistory: [],
      constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 0,
    },
    signal: new AbortController().signal,
  });

  assert.deepEqual(action, {
    kind: 'agentBrowserCommand',
    command: 'click',
    args: ['@e2'],
    reason: 'Click @e2',
  });
});

test('decideNext accepts agentBrowserCommand JSON', async () => {
  const runner = new AgentModelRunner({
    modelConnect: fakeModelConnect({
      content:
        '{"kind":"agentBrowserCommand","command":"find","args":["role","button","click","--name","Add to Cart"],"reason":"Click Add to Cart product button"}',
    }),
  });

  const action = await runner.decideNext({
    profile: 'coder',
    skill: { name: 'test-run-ui-browser-agent', content: '# skill' },
    context: {
      scenarioTitle: 'Add to cart',
      gherkinSteps: [
        { index: 0, kind: 'Given', effectiveKind: 'Given', text: 'the user is on the home page' },
        { index: 1, kind: 'When', effectiveKind: 'When', text: 'the user clicks Add to Cart' },
      ],
      currentStepIndex: 1,
      completedSteps: [{ index: 0, note: 'Home open' }],
      thenVerdicts: [],
      pageSnapshot: '- button "Add to Cart" @e8',
      actionHistory: [],
      constraints: { behavior: 'Add to cart', maxStepDurationMs: 20_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 1,
    },
    signal: new AbortController().signal,
  });

  assert.deepEqual(action, {
    kind: 'agentBrowserCommand',
    command: 'find',
    args: ['role', 'button', 'click', '--name', 'Add to Cart'],
    reason: 'Click Add to Cart product button',
  });
});

test('decideNext normalizes stepComplete missing required fields', async () => {
  let calls = 0;
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async () => {
          calls += 1;
          return { content: '{"kind":"stepComplete"}' };
        },
      }),
    } as never,
  });

  const action = await runner.decideNext({
    profile: 'coder',
    skill: { name: 'test-run-ui-browser-agent', content: 'rules' },
    context: {
      scenarioTitle: 'Shop now',
      gherkinSteps: [{ index: 0, kind: 'Given', effectiveKind: 'Given', text: 'the user is on the home page' }],
      currentStepIndex: 0,
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '',
      actionHistory: [],
      constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 0,
    },
    signal: new AbortController().signal,
  });

  assert.equal(action.kind, 'stepComplete');
  assert.equal(action.stepIndex, 0);
  assert.ok(action.note);
  assert.equal(calls, 1);
});
