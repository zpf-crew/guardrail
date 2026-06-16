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
  assert.equal((capturedOptions as { maxTokens?: number }).maxTokens, 10000);
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

test('retries transient model content failures for structured steps', async () => {
  let calls = 0;
  const runner = new StructuredModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async () => {
          calls += 1;
          if (calls === 1) {
            throw new Error('LLM response did not contain assistant content');
          }
          return {
            content: '{"proposedActions":[],"risk":{"productionCodeChanges":"none","testDataChanges":false,"browserAutomationRequired":true,"mobileSimulatorRequired":"no","externalApiMocking":"no"},"filesToChange":[],"questions":[]}',
          };
        },
      }),
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
  assert.equal(calls, 2);
});

test('structured runner repairs invalid JSON with validation hint', async () => {
  const userMessages: string[] = [];
  let calls = 0;
  const runner = new StructuredModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async (messages: Array<{ role: string; content: string }>) => {
          calls += 1;
          userMessages.push(messages.find(message => message.role === 'user')!.content);
          if (calls === 1) return { content: 'not json' };
          return {
            content: '{"proposedActions":[],"risk":{"productionCodeChanges":"none","testDataChanges":false,"browserAutomationRequired":true,"mobileSimulatorRequired":"no","externalApiMocking":"no"},"filesToChange":[],"questions":[]}',
          };
        },
      }),
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
  assert.equal(calls, 2);
  assert.match(userMessages[1]!, /validationError/);
  assert.match(userMessages[1]!, /Return only one valid TestPlan JSON object/);
});
