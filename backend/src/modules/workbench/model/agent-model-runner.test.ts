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

function fakeSequenceModelConnect(responses: Array<{ content: string }>) {
  let index = 0;
  return {
    getClient: () => ({
      chat: async () => responses[Math.min(index++, responses.length - 1)]!,
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

test('decideNext extracts JSON object from prose model output', async () => {
  const runner = new AgentModelRunner({
    modelConnect: fakeModelConnect({
      content:
        'Looking at the snapshot, the search input is visible. {"kind":"agentBrowserCommand","command":"fill","args":["@e2","headphone"],"reason":"Enter search text"}',
    }),
  });

  const action = await runner.decideNext({
    profile: 'coder',
    skill: { name: 'test-run-ui-browser-agent', content: '# skill' },
    context: {
      scenarioTitle: 'Search',
      gherkinSteps: [
        { index: 0, kind: 'When', effectiveKind: 'When', text: 'the user searches for headphone' },
      ],
      currentStepIndex: 0,
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '- searchbox "Search" @e2',
      actionHistory: [],
      constraints: { behavior: 'Search', maxStepDurationMs: 60_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 1,
    },
    signal: new AbortController().signal,
  });

  assert.deepEqual(action, {
    kind: 'agentBrowserCommand',
    command: 'fill',
    args: ['@e2', 'headphone'],
    reason: 'Enter search text',
  });
});

test('decideNext retries prose-only output with stricter JSON instruction', async () => {
  const runner = new AgentModelRunner({
    modelConnect: fakeSequenceModelConnect([
      { content: 'Looking at the snapshot, I should click the Add to Cart button.' },
      { content: '{"kind":"agentBrowserCommand","command":"click","args":["@e8"],"reason":"Click Add to Cart"}' },
    ]),
  });

  const action = await runner.decideNext({
    profile: 'coder',
    skill: { name: 'test-run-ui-browser-agent', content: '# skill' },
    context: {
      scenarioTitle: 'Add to cart',
      gherkinSteps: [
        { index: 0, kind: 'When', effectiveKind: 'When', text: 'the user adds a product to cart' },
      ],
      currentStepIndex: 0,
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '- button "Add to Cart" @e8',
      actionHistory: [],
      constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 1,
    },
    signal: new AbortController().signal,
  });

  assert.deepEqual(action, {
    kind: 'agentBrowserCommand',
    command: 'click',
    args: ['@e8'],
    reason: 'Click Add to Cart',
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

test('planScenario validates concise UI browser scenario plan JSON', async () => {
  const runner = new AgentModelRunner({
    modelConnect: fakeModelConnect({
      content: JSON.stringify({
        title: 'Add to cart',
        steps: [
          {
            id: 'step-1',
            kind: 'setup',
            sourceStepIndexes: [0],
            instruction: 'Open the home page',
            successCriteria: 'The home page is loaded',
          },
          {
            id: 'step-2',
            kind: 'action',
            sourceStepIndexes: [1],
            instruction: 'Find the first Add to Cart button, scrolling if needed, and click it',
            successCriteria: 'The click completes',
          },
          {
            id: 'step-3',
            kind: 'assert',
            sourceStepIndexes: [3],
            instruction: 'Verify the cart count increased',
            successCriteria: 'A durable cart count shows 1 item',
          },
        ],
      }),
    }),
  });

  const plan = await runner.planScenario({
    profile: 'coder',
    skill: { name: 'test-plan-ui-browser-scenario', content: '# skill' },
    context: { gherkinText: 'Scenario: Add to cart' },
    signal: new AbortController().signal,
  });

  assert.equal(plan.title, 'Add to cart');
  assert.deepEqual(plan.steps.map(step => step.kind), ['setup', 'action', 'assert']);
});
