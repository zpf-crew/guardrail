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
      currentStep: {
        index: 1,
        kind: 'Given',
        effectiveKind: 'Given',
        text: '',
        observationOnlyActionsUsed: 0,
        observationOnlyActionsRemaining: 3,
        verdictRequiredNow: false,
      },
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '',
      actionHistory: [],
      constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 0,
      allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
      allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
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
      currentStep: {
        index: 1,
        kind: 'When',
        effectiveKind: 'When',
        text: 'the user clicks Add to Cart',
        observationOnlyActionsUsed: 0,
        observationOnlyActionsRemaining: 3,
        verdictRequiredNow: false,
      },
      completedSteps: [{ index: 0, note: 'Home open' }],
      thenVerdicts: [],
      pageSnapshot: '- button "Add to Cart" @e8',
      actionHistory: [],
      constraints: { behavior: 'Add to cart', maxStepDurationMs: 20_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 1,
      allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
      allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
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
      currentStep: {
        index: 0,
        kind: 'When',
        effectiveKind: 'When',
        text: 'the user searches for headphone',
        observationOnlyActionsUsed: 0,
        observationOnlyActionsRemaining: 3,
        verdictRequiredNow: false,
      },
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '- searchbox "Search" @e2',
      actionHistory: [],
      constraints: { behavior: 'Search', maxStepDurationMs: 60_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 1,
      allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
      allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
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

test('decideNext extracts first JSON object when model appends trailing prose', async () => {
  const runner = new AgentModelRunner({
    modelConnect: fakeModelConnect({
      content:
        '{"kind":"agentBrowserCommand","command":"press","args":["Enter"],"reason":"Submit search"} The search field has been filled, so pressing Enter submits it.',
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
      currentStep: {
        index: 0,
        kind: 'When',
        effectiveKind: 'When',
        text: 'the user searches for headphone',
        observationOnlyActionsUsed: 0,
        observationOnlyActionsRemaining: 3,
        verdictRequiredNow: false,
      },
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '- searchbox "Search products" @e67: headphone',
      actionHistory: [{ iteration: 1, action: 'fill @e67 [redacted]', result: 'ok' }],
      constraints: { behavior: 'Search', maxStepDurationMs: 60_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 2,
      allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
      allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
    },
    signal: new AbortController().signal,
  });

  assert.deepEqual(action, {
    kind: 'agentBrowserCommand',
    command: 'press',
    args: ['Enter'],
    reason: 'Submit search',
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
      currentStep: {
        index: 0,
        kind: 'When',
        effectiveKind: 'When',
        text: 'the user adds a product to cart',
        observationOnlyActionsUsed: 0,
        observationOnlyActionsRemaining: 3,
        verdictRequiredNow: false,
      },
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '- button "Add to Cart" @e8',
      actionHistory: [],
      constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 1,
      allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
      allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
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
  let capturedMaxTokens: number | undefined;
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async (_messages: unknown, options: { maxTokens?: number }) => {
          calls += 1;
          capturedMaxTokens = options.maxTokens;
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
      currentStep: {
        index: 0,
        kind: 'Given',
        effectiveKind: 'Given',
        text: 'the user is on the home page',
        observationOnlyActionsUsed: 0,
        observationOnlyActionsRemaining: 3,
        verdictRequiredNow: false,
      },
      completedSteps: [],
      thenVerdicts: [],
      pageSnapshot: '',
      actionHistory: [],
      constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
      elapsedMs: 0,
      iterationsUsed: 0,
      allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
      allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
    },
    signal: new AbortController().signal,
  });

  assert.equal(action.kind, 'stepComplete');
  assert.equal(action.stepIndex, 0);
  assert.ok(action.note);
  assert.equal(calls, 1);
  assert.equal(capturedMaxTokens, 1500);
});

test('plans UI Browser user flows', async () => {
  let capturedMaxTokens: number | undefined;
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async (_messages: unknown, options: { maxTokens?: number }) => {
          capturedMaxTokens = options.maxTokens;
          return {
            content: JSON.stringify({
              behaviorTitle: 'Add product to cart from homepage',
              acceptedFlows: [
                {
                  id: 'flow-1',
                  title: 'Add one product to cart',
                  sourceScenarioIndexes: [0],
                  userGoal: 'A shopper adds a product to the cart.',
                  durableOutcome: 'The cart count shows one item.',
                  priority: 'high',
                },
              ],
              droppedScenarios: [],
            }),
          };
        },
      }),
    } as never,
  });

  const result = await runner.planUiBrowserFlows({
    profile: 'coder',
    skill: { name: 'test-plan-ui-browser-flows', content: 'Return JSON only.' },
    context: { schemaName: 'UiBrowserUserFlowPlan' },
    signal: new AbortController().signal,
  });

  assert.equal(result.acceptedFlows[0].id, 'flow-1');
  assert.equal(capturedMaxTokens, 4000);
});

test('plans UI Browser execution steps', async () => {
  let capturedMaxTokens: number | undefined;
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async (_messages: unknown, options: { maxTokens?: number }) => {
          capturedMaxTokens = options.maxTokens;
          return {
            content: JSON.stringify({
              flowId: 'flow-1',
              title: 'Add one product to cart',
              steps: [
                {
                  id: 'step-1',
                  kind: 'setup',
                  instruction: 'Open the homepage.',
                  successCriteria: 'The homepage is loaded.',
                },
                {
                  id: 'step-2',
                  kind: 'action',
                  instruction: 'Click Add to Cart.',
                  successCriteria: 'The click completes.',
                },
                {
                  id: 'step-3',
                  kind: 'assert',
                  instruction: 'Verify the cart contains one item.',
                  successCriteria: 'The cart shows one item.',
                },
              ],
            }),
          };
        },
      }),
    } as never,
  });

  const result = await runner.planUiBrowserExecution({
    profile: 'coder',
    skill: { name: 'test-plan-ui-browser-execution', content: 'Return JSON only.' },
    context: { schemaName: 'UiBrowserExecutionPlan' },
    signal: new AbortController().signal,
  });

  assert.equal(result.steps[2].kind, 'assert');
  assert.equal(capturedMaxTokens, 4000);
});

test('plans UI Browser user flows after transient missing assistant content', async () => {
  let calls = 0;
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async () => {
          calls += 1;
          if (calls === 1) {
            throw new Error('LLM response did not contain assistant content');
          }
          return {
            content: JSON.stringify({
              behaviorTitle: 'Add product to cart from homepage',
              acceptedFlows: [
                {
                  id: 'flow-1',
                  title: 'Add one product to cart',
                  sourceScenarioIndexes: [0],
                  userGoal: 'A shopper adds a product to the cart.',
                  durableOutcome: 'The cart count shows one item.',
                  priority: 'high',
                },
              ],
              droppedScenarios: [],
            }),
          };
        },
      }),
    } as never,
  });

  const result = await runner.planUiBrowserFlows({
    profile: 'coder',
    skill: { name: 'test-plan-ui-browser-flows', content: 'Return JSON only.' },
    context: { schemaName: 'UiBrowserUserFlowPlan' },
    signal: new AbortController().signal,
  });

  assert.equal(result.acceptedFlows[0]?.id, 'flow-1');
  assert.equal(calls, 2);
});

test('UI Browser execution planning repairs invalid JSON with validation hint', async () => {
  const userMessages: string[] = [];
  let calls = 0;
  const runner = new AgentModelRunner({
    modelConnect: {
      getClient: () => ({
        chat: async (messages: Array<{ role: string; content: string }>) => {
          calls += 1;
          userMessages.push(messages.find(message => message.role === 'user')!.content);
          if (calls === 1) return { content: 'not json' };
          return {
            content: JSON.stringify({
              flowId: 'flow-1',
              title: 'Add one product to cart',
              steps: [
                {
                  id: 'step-1',
                  kind: 'setup',
                  instruction: 'Open the homepage.',
                  successCriteria: 'The homepage is loaded.',
                },
              ],
            }),
          };
        },
      }),
    } as never,
  });

  const result = await runner.planUiBrowserExecution({
    profile: 'coder',
    skill: { name: 'test-plan-ui-browser-execution', content: 'Return JSON only.' },
    context: { schemaName: 'UiBrowserExecutionPlan' },
    signal: new AbortController().signal,
  });

  assert.equal(result.flowId, 'flow-1');
  assert.equal(calls, 2);
  assert.match(userMessages[1]!, /validationError/);
  assert.match(userMessages[1]!, /Return only one valid UiBrowserExecutionPlan JSON object/);
});
