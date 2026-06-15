import test from 'node:test';
import assert from 'node:assert/strict';
import { StructuredModelRunner } from './structured-model-runner.js';

test('parses fenced json and validates output', async () => {
  const thinkerClient = {
    chat: async () => ({
      content:
        '```json\n{"proposedActions":[],"risk":{"productionCodeChanges":"none","testDataChanges":false,"browserAutomationRequired":true,"mobileSimulatorRequired":"no","externalApiMocking":"no"},"filesToChange":[],"questions":[]}\n```',
    }),
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
});

test('extracts the first JSON object from fenced output with trailing prose', async () => {
  const coderClient = {
    chat: async () => ({
      content: [
        '```json',
        '{"changes":[]}',
        '```',
        'Generated from repository evidence.',
      ].join('\n'),
    }),
  };

  const runner = new StructuredModelRunner({
    modelConnect: {
      getClient: () => coderClient,
      getThinker: () => coderClient,
      getCoder: () => coderClient,
    } as never,
  });

  const result = await runner.runStep({
    profile: 'coder',
    skill: { name: 'test-generate-unit', content: '# Generate unit tests' },
    schemaName: 'GenerationChanges',
    context: {},
    signal: new AbortController().signal,
  });

  assert.deepEqual(result.changes, []);
});

test('extracts JSON from inline fenced output', async () => {
  const coderClient = {
    chat: async () => ({
      content: '```json { "changes": [] } ```',
    }),
  };

  const runner = new StructuredModelRunner({
    modelConnect: {
      getClient: () => coderClient,
      getThinker: () => coderClient,
      getCoder: () => coderClient,
    } as never,
  });

  const result = await runner.runStep({
    profile: 'coder',
    skill: { name: 'test-generate-unit', content: '# Generate unit tests' },
    schemaName: 'GenerationChanges',
    context: {},
    signal: new AbortController().signal,
  });

  assert.deepEqual(result.changes, []);
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

test('uses schema-specific token budgets instead of one unbounded limit', async () => {
  const calls: Array<{ schemaName: string; maxTokens: number | undefined }> = [];
  const client = {
    chat: async (
      messages: Array<{ role: string; content: string }>,
      options: { maxTokens?: number },
    ) => {
      const request = JSON.parse(messages[1]!.content) as { schemaName: string };
      calls.push({ schemaName: request.schemaName, maxTokens: options.maxTokens });
      return {
        content: request.schemaName === 'GenerationChanges'
          ? '{"changes":[]}'
          : '{"questions":[]}',
      };
    },
  };
  const runner = new StructuredModelRunner({
    modelConnect: {
      getClient: () => client,
      getThinker: () => client,
      getCoder: () => client,
    } as never,
  });

  await runner.runStep({
    profile: 'coder',
    skill: { name: 'test-generate-unit', content: '# Generate unit tests' },
    schemaName: 'GenerationChanges',
    context: {},
    signal: new AbortController().signal,
  });
  await runner.runStep({
    profile: 'thinker',
    skill: { name: 'test-plan-unit', content: '# Plan unit tests' },
    schemaName: 'TestPlanQuestions',
    context: {},
    signal: new AbortController().signal,
  });

  assert.deepEqual(calls, [
    { schemaName: 'GenerationChanges', maxTokens: 12_000 },
    { schemaName: 'TestPlanQuestions', maxTokens: 2_000 },
  ]);
});
