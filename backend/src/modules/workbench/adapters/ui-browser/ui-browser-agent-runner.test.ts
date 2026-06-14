import test from 'node:test';
import assert from 'node:assert/strict';
import { UiBrowserAgentRunner } from './ui-browser-agent-runner.js';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

const scenario = `
Scenario: Shop now navigation
  Given the user is on the home page
  When the user clicks Shop Now
  Then the products page is displayed
`;

test('agent runner opens the managed default route before first snapshot', async () => {
  const calls: string[][] = [];
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => ({ kind: 'stepFailed', stepIndex: 0, reason: 'Stop after first snapshot' }),
    execute: async args => {
      calls.push(args);
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/initial.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/products',
    signal: new AbortController().signal,
  });

  assert.deepEqual(calls.slice(0, 2), [
    ['open', 'http://127.0.0.1:5555/products'],
    ['snapshot', '-i'],
  ]);
});

test('agent runner passes when model completes all Then steps', async () => {
  let call = 0;
  const streamedLabels: string[] = [];
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'agentBrowserCommand', command: 'open', args: ['/'], reason: 'Open home page' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Home loaded' },
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e3'], reason: 'Click Shop Now' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked Shop Now' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Products heading visible' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      if (args[0] === 'snapshot') {
        return { exitCode: 0, stdout: '- button "Shop Now" @e3', stderr: '' };
      }
      if (args[0] === 'screenshot') {
        return { exitCode: 0, stdout: 'Screenshot saved to /tmp/products-verified.png', stderr: '' };
      }
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
    onScreenshot: async evidence => {
      streamedLabels.push(evidence.label);
      return { ...evidence, href: `/api/workbench/wb-test/artifacts/${streamedLabels.length}.png` };
    },
  });

  assert.equal(result.outcome, 'Passed');
  assert.equal(result.thenVerdicts.length, 1);
  assert.equal(result.thenVerdicts[0]?.satisfied, true);
  assert.deepEqual(streamedLabels, ['Verified — the products page is displayed']);
  assert.equal(result.evidence[0]?.href, '/api/workbench/wb-test/artifacts/1.png');
});

test('agent runner fails fast on assertThen satisfied false', async () => {
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'agentBrowserCommand', command: 'open', args: ['/'], reason: 'Open home page' },
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked' },
    { kind: 'assertThen', stepIndex: 2, satisfied: false, reason: 'Still on home page' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++]!,
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
      if (args[0] === 'screenshot') {
        return { exitCode: 0, stdout: 'Screenshot saved to /tmp/failure.png', stderr: '' };
      }
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /Still on home page/);
  assert.ok(result.evidence.some(item => item.kind === 'screenshot'));
  assert.ok(result.evidence.some(item => item.kind === 'trace'));
});

test('agent runner rejects model-controlled screenshot commands', async () => {
  let call = 0;
  const streamedLabels: string[] = [];
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'agentBrowserCommand', command: 'screenshot', args: [], reason: 'Home loaded' },
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked Shop Now' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Products heading visible' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
      if (args[0] === 'screenshot') {
        return { exitCode: 0, stdout: 'Screenshot saved to /tmp/home-loaded.png', stderr: '' };
      }
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
    onScreenshot: async evidence => {
      streamedLabels.push(evidence.label);
      return { ...evidence, href: `/api/workbench/wb-test/artifacts/${streamedLabels.length}.png` };
    },
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /not allowed for current step/);
  assert.match(result.reason ?? '', /screenshot/);
  assert.equal(streamedLabels.includes('Home loaded'), false);
  assert.ok(result.evidence.some(item => item.kind === 'trace'));
});

test('agent runner emits progress when a browser action fails', async () => {
  let call = 0;
  const progress: string[] = [];
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e3'], reason: 'Click Shop Now' },
    { kind: 'stepFailed', stepIndex: 0, reason: 'Could not click Shop Now' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'stepFailed', stepIndex: 0, reason: 'stuck' },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Shop Now" @e3', stderr: '' };
      if (args[0] === 'click') return { exitCode: 1, stdout: '', stderr: 'element detached' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/failure.png', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
    onProgress: message => progress.push(message),
  });

  assert.equal(result.outcome, 'Failed');
  assert.ok(progress.some(message => /Browser action failed — click @e3: element detached/.test(message)));
});

test('agent runner auto-completes action steps after primary action when model asks for extra evidence', async () => {
  let call = 0;
  const executed: string[][] = [];
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e3'], reason: 'Click Shop Now' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Extra evidence that belongs to a later Then' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Products heading visible' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      executed.push(args);
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Shop Now" @e3', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Passed');
  assert.ok(executed.some(args => args[0] === 'click'));
  assert.equal(executed.some(args => args[0] === 'snapshot'), true);
});

test('agent runner scrolls direct refs into view before primary actions', async () => {
  let call = 0;
  const executed: string[][] = [];
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e41'], reason: 'Click Add to Cart' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Extra evidence' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Cart count updated' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      executed.push(args);
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Add to Cart" @e41', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: `
Scenario: Add to cart
  Given the user is on the home page
  When the user clicks Add to Cart
  Then the product should be added to the cart
`,
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Passed');
  const scrollIndex = executed.findIndex(args => args[0] === 'scrollintoview' && args[1] === '@e41');
  const clickIndex = executed.findIndex(args => args[0] === 'click' && args[1] === '@e41');
  assert.ok(scrollIndex >= 0);
  assert.ok(clickIndex > scrollIndex);
});

test('agent runner auto-completes a When step after a duplicate click request', async () => {
  let call = 0;
  const executed: string[][] = [];
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e41'], reason: 'Click Add to Cart' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e42'], reason: 'Click Add to Cart again' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Cart count is 1' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      executed.push(args);
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Add to Cart" @e41\n- button "Add to Cart" @e42', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: `
Scenario: Add to cart
  Given the user is on the home page
  When the user clicks Add to Cart
  Then the product should be added to the cart
`,
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Passed');
  assert.ok(executed.some(args => args[0] === 'click' && args[1] === '@e41'));
  assert.equal(executed.some(args => args[0] === 'click' && args[1] === '@e42'), false);
});

test('agent runner executes concise planned steps instead of raw transient Gherkin checks', async () => {
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e41'], reason: 'Click Add to Cart' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Extra evidence' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Cart count is 1' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- link "Shopping cart" @e15\n- generic "ShopMaxHomeProductsWishlist1"', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/transient-toast.png', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const progress: string[] = [];
  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: `
Scenario: Add to cart
  Given the user is on the home page
  When the user clicks Add to Cart
  Then I should see a success toast notification with message containing "added"
  Then the cart count should increase to 1
`,
    scenarioPlan: {
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
          successCriteria: 'The click completes without leaving the page',
        },
        {
          id: 'step-3',
          kind: 'assert',
          sourceStepIndexes: [3],
          instruction: 'Verify the cart count increased to 1',
          successCriteria: 'A durable cart count or cart state shows 1 item',
        },
      ],
    },
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
    onProgress: message => progress.push(message),
  });

  assert.equal(result.outcome, 'Passed');
  assert.equal(result.thenVerdicts[0]?.stepIndex, 2);
  assert.equal(result.thenVerdicts[0]?.satisfied, true);
  assert.equal(result.thenVerdicts.length, 1);
  assert.ok(progress.some(message => /Step 3\/3/.test(message)));
});

test('agent runner tells the model to return a verdict after one Then observation', async () => {
  const thenContextValues: Array<{ effectiveKind: string; verdictRequiredNow: boolean }> = [];
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e3'], reason: 'Click Add to Cart' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked Add to Cart' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Check cart count' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Shopping cart shows 1 item' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async context => {
      if (context.currentStep.effectiveKind === 'Then') {
        thenContextValues.push({
          effectiveKind: context.currentStep.effectiveKind,
          verdictRequiredNow: context.currentStep.verdictRequiredNow,
        });
      }
      return scripted[call++] ?? { kind: 'scenarioComplete' };
    },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Add to Cart" @e3\n- link "Shopping cart 1" @e4', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/asserted-cart.png', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: `
Scenario: Add to cart
  Given the user is on the home page
  When the user clicks Add to Cart
  Then the product should be added to the cart
`,
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Passed');
  assert.deepEqual(thenContextValues, [
    { effectiveKind: 'Then', verdictRequiredNow: false },
    { effectiveKind: 'Then', verdictRequiredNow: true },
  ]);
  assert.equal(result.thenVerdicts[0]?.satisfied, true);
});

test('agent runner fails clearly when model ignores verdict-only Then turn', async () => {
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e3'], reason: 'Click Add to Cart' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked Add to Cart' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Check cart count' },
    { kind: 'agentBrowserCommand', command: 'screenshot', args: [], reason: 'Keep looking instead of asserting' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Add to Cart" @e3\n- link "Shopping cart 1" @e4', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/ignored-contract.png', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: `
Scenario: Add to cart
  Given the user is on the home page
  When the user clicks Add to Cart
  Then the product should be added to the cart
`,
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /Verdict required now/);
  assert.match(result.reason ?? '', /assertThen or stepFailed/);
});

test('agent runner rejects screenshot commands on Then steps', async () => {
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e3'], reason: 'Click Add to Cart' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked Add to Cart' },
    { kind: 'agentBrowserCommand', command: 'screenshot', args: [], reason: 'Try screenshot instead of verdict' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => scripted[call++] ?? { kind: 'scenarioComplete' },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Add to Cart" @e3\n- link "Shopping cart 1" @e4', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/then-screenshot.png', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: `
Scenario: Add to cart
  Given the user is on the home page
  When the user clicks Add to Cart
  Then the product should be added to the cart
`,
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /not allowed for current step/);
  assert.match(result.reason ?? '', /screenshot/);
});

test('agent runner rejects unsafe commands before progress logging', async () => {
  const progress: string[] = [];
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => ({
      kind: 'agentBrowserCommand',
      command: 'click',
      args: ['@e3', '--new-tab'],
      reason: 'Open link in new tab',
    }),
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- link "External" @e3', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/rejected.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
    onProgress: message => progress.push(message),
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /click flag "--new-tab" is not allowed/);
  assert.deepEqual(progress, []);
});

test('agent runner fails when a state-changing command leaves managed origin', async () => {
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => ({
      kind: 'agentBrowserCommand',
      command: 'click',
      args: ['@e3'],
      reason: 'Click external link',
    }),
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- link "External" @e3', stderr: '' };
      if (args[0] === 'click') return { exitCode: 0, stdout: 'ok', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'https://example.com/', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/external.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /External navigation is not allowed/);
});

test('agent runner applies timeout per current Gherkin step', async () => {
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => ({ kind: 'stepComplete', stepIndex: 0, note: 'Home open' }),
    execute: async args => {
      if (args[0] === 'snapshot') {
        await delay(5);
        return { exitCode: 0, stdout: '@e1', stderr: '' };
      }
      if (args[0] === 'screenshot') {
        return { exitCode: 0, stdout: 'Screenshot saved to /tmp/step-timeout.png', stderr: '' };
      }
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 1, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /Exceeded max step duration \(1ms\) on step 1\/3/);
  assert.ok(result.evidence.some(item => item.kind === 'screenshot'));
  assert.ok(result.evidence.some(item => item.kind === 'trace'));
});

test('agent runner does not count model decision latency against step duration', async () => {
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => {
      await delay(5);
      return { kind: 'stepComplete', stepIndex: 0, note: 'Home open' };
    },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/model-latency.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 1_000, maxSteps: 1 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.match(result.reason ?? '', /Exceeded max 1 agent steps/);
  assert.doesNotMatch(result.reason ?? '', /Exceeded max step duration/);
});

test('agent runner writes raw trace evidence with decisions commands and snapshots', async () => {
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => ({ kind: 'stepFailed', stepIndex: 0, reason: 'Stop with trace' }),
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '- button "Continue" @e1', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/trace-failure.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  const trace = result.evidence.find(item => item.kind === 'trace');
  assert.ok(trace);
  assert.match(trace.href ?? '', /guardrail-ui-browser-traces\/.+\.json$/);
  assert.equal(trace.label, 'UI Browser raw trace');
});

test('agent runner allows total scenario duration to exceed one step budget after progress', async () => {
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'stepComplete', stepIndex: 1, note: 'Clicked Shop Now' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Products heading visible' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async () => {
      await delay(8);
      return scripted[call++] ?? { kind: 'scenarioComplete' };
    },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
      if (args[0] === 'get' && args[1] === 'url') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Passed');
  assert.ok(result.durationMs >= 20);
});

test('agent runner records informative command output in action history context', async () => {
  const observedHistory: string[] = [];
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'agentBrowserCommand', command: 'get', args: ['url'], reason: 'Check current URL' },
    { kind: 'stepFailed', stepIndex: 0, reason: 'Stop after observing history' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async context => {
      observedHistory.push(context.actionHistory[0]?.detail ?? '');
      return scripted[call++] ?? { kind: 'stepFailed', stepIndex: 0, reason: 'done' };
    },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
      if (args[0] === 'get') return { exitCode: 0, stdout: 'http://127.0.0.1:5555/products', stderr: '' };
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: 'Screenshot saved to /tmp/failure.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.deepEqual(observedHistory, ['', 'http://127.0.0.1:5555/products']);
});

test('uses execution plan steps instead of raw Gherkin when provided', async () => {
  const actions: UiBrowserAgentAction[] = [
    { kind: 'stepComplete', stepIndex: 0, note: 'Homepage loaded.' },
    { kind: 'agentBrowserCommand', command: 'click', args: ['@e1'], reason: 'Click Add to Cart.' },
    { kind: 'agentBrowserCommand', command: 'snapshot', args: ['-i'], reason: 'Extra evidence that should be skipped.' },
    { kind: 'assertThen', stepIndex: 2, satisfied: true, reason: 'Cart shows one item.' },
    { kind: 'scenarioComplete' },
  ];

  const runner = new UiBrowserAgentRunner({
    decideNext: async context => {
      assert.match(context.gherkinSteps[1].text, /Click Add to Cart/);
      return actions.shift()!;
    },
    execute: fakeExecutor({
      snapshot: 'button "Add to Cart" @e1\ntext "Cart 1" @e2',
      screenshotPath: '/tmp/cart.png',
    }),
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5173',
    gherkinText: 'Scenario: Raw scenario\nThen raw text should not drive execution',
    executionPlan: {
      flowId: 'flow-1',
      title: 'Add one product to cart',
      steps: [
        { id: 'step-1', kind: 'setup', instruction: 'Open the homepage.', successCriteria: 'Homepage loaded.' },
        { id: 'step-2', kind: 'action', instruction: 'Click Add to Cart.', successCriteria: 'Click completes.' },
        { id: 'step-3', kind: 'assert', instruction: 'Verify cart contains one item.', successCriteria: 'Cart shows one item.' },
      ],
    },
    constraints: { behavior: 'Cart', maxStepDurationMs: 60000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Passed');
});

test('rejects mutating browser commands during assert steps', async () => {
  const runner = new UiBrowserAgentRunner({
    decideNext: async () => ({ kind: 'agentBrowserCommand', command: 'click', args: ['@e1'], reason: 'Do not mutate during assert.' }),
    execute: fakeExecutor({ snapshot: 'button "Cart" @e1' }),
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5173',
    gherkinText: 'Scenario: Assert only',
    executionPlan: {
      flowId: 'flow-1',
      title: 'Assert cart',
      steps: [
        { id: 'step-1', kind: 'assert', instruction: 'Verify cart has one item.', successCriteria: 'Cart shows one item.' },
      ],
    },
    constraints: { behavior: 'Cart', maxStepDurationMs: 60000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /agent-browser command click is not allowed for current step/);
});

function fakeExecutor(options: { snapshot?: string; screenshotPath?: string }) {
  return async (args: string[]) => {
    if (args[0] === 'snapshot') {
      return { exitCode: 0, stdout: options.snapshot ?? '@e1', stderr: '' };
    }
    if (args[0] === 'screenshot') {
      const path = options.screenshotPath ?? '/tmp/screenshot.png';
      return { exitCode: 0, stdout: `Screenshot saved to ${path}`, stderr: '' };
    }
    if (args[0] === 'get' && args[1] === 'url') {
      return { exitCode: 0, stdout: 'http://127.0.0.1:5173/', stderr: '' };
    }
    return { exitCode: 0, stdout: 'ok', stderr: '' };
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
