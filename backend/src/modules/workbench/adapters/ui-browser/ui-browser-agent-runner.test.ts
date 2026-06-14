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
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'agentBrowserCommand', command: 'open', args: ['/'], reason: 'Open home page' },
    { kind: 'agentBrowserCommand', command: 'screenshot', args: [], reason: 'Home loaded' },
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
  assert.equal(result.thenVerdicts.length, 1);
  assert.equal(result.thenVerdicts[0]?.satisfied, true);
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
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0]?.kind, 'screenshot');
});

test('agent runner streams screenshot evidence from command envelope', async () => {
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

  assert.deepEqual(streamedLabels, ['Home loaded']);
  assert.equal(result.evidence[0]?.href, '/api/workbench/wb-test/artifacts/1.png');
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
    decideNext: async () => {
      await delay(5);
      return { kind: 'stepComplete', stepIndex: 0, note: 'Home open' };
    },
    execute: async args => {
      if (args[0] === 'snapshot') return { exitCode: 0, stdout: '@e1', stderr: '' };
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
  assert.equal(result.evidence[0]?.kind, 'screenshot');
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
