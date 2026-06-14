import test from 'node:test';
import assert from 'node:assert/strict';
import { StructuredModelRunner } from './structured-model-runner.js';

test('parses fenced json and validates output', async () => {
  let capturedOptions: unknown;
  const thinkerClient = {
    chat: async (_messages: unknown, options: unknown) => {
      capturedOptions = options;
      return {
        content:
          '```json\n{"proposedActions":[],"risk":{"productionCodeChanges":"none","testDataChanges":false,"browserAutomationRequired":true,"mobileSimulatorRequired":"no","externalApiMocking":"no"},"filesToChange":[],"questions":[]}\n```',
      };
    },
  };

  const runner = new StructuredModelRunner({
    modelConnect: {
      getClient: () => thinkerClient,
      getThinker: () => thinkerClient,
      getCoder: () => ({ chat: async () => ({ content: '{}' }) }),
    } as never,
  });

  const result = await runner.runStep({
    profile: 'thinker',
    skill: { name: 'test-plan', content: '# Plan' },
    schemaName: 'TestPlan',
    context: { intent: { prompt: 'improve onboarding UI test' } },
    signal: new AbortController().signal,
  });

  assert.equal(result.risk.browserAutomationRequired, true);
  assert.equal((capturedOptions as { maxTokens?: number }).maxTokens, 8000);
});

test('fails clearly when model is unavailable', async () => {
  const runner = new StructuredModelRunner({ modelConnect: null });

  await assert.rejects(
    () =>
      runner.runStep({
        profile: 'thinker',
        skill: { name: 'test-plan', content: '# Plan' },
        schemaName: 'TestPlan',
        context: {},
        signal: new AbortController().signal,
      }),
    /LLM is not configured/,
  );
});
