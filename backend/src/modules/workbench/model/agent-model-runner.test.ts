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
    context: { currentStepIndex: 1 },
    signal: new AbortController().signal,
  });

  assert.equal(action.kind, 'click');
  assert.equal(action.ref, '@e2');
});
