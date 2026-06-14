import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentModelRunner } from './agent-model-runner.js';

test('decideNext validates model JSON into UiBrowserAgentAction', async () => {
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async () => ({ content: '{"kind":"click","ref":"@e2"}' }),
      }),
    } as never,
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
      constraints: { behavior: 'Shop now', maxDurationMs: 60_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 0,
    },
    signal: new AbortController().signal,
  });

  assert.equal(action.kind, 'click');
  assert.equal(action.ref, '@e2');
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
      constraints: { behavior: 'Shop now', maxDurationMs: 60_000, maxSteps: 15 },
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
