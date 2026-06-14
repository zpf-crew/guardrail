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

test('agent runner passes when model completes all Then steps', async () => {
  let call = 0;
  const scripted: UiBrowserAgentAction[] = [
    { kind: 'open', path: '/' },
    { kind: 'screenshot', label: 'Home loaded' },
    { kind: 'stepComplete', stepIndex: 0, note: 'Home open' },
    { kind: 'click', ref: '@e3' },
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
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxDurationMs: 60_000, maxSteps: 15 },
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
    { kind: 'open', path: '/' },
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
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.runScenario({
    baseUrl: 'http://127.0.0.1:5555',
    gherkinText: scenario,
    constraints: { behavior: 'Shop now', maxDurationMs: 60_000, maxSteps: 15 },
    defaultRoute: '/',
    signal: new AbortController().signal,
  });

  assert.equal(result.outcome, 'Failed');
  assert.match(result.reason ?? '', /Still on home page/);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0]?.kind, 'screenshot');
});
