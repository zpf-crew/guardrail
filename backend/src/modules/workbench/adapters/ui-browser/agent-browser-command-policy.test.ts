import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSameOriginUrl,
  agentBrowserCommandArgs,
  isExecutableAgentBrowserCommand,
  shouldVerifySameOriginAfterCommand,
  validateAgentBrowserCommand,
} from './agent-browser-command-policy.js';

test('agentBrowserCommandArgs allows core interaction commands', () => {
  assert.deepEqual(
    agentBrowserCommandArgs('http://127.0.0.1:5173', {
      kind: 'agentBrowserCommand',
      command: 'click',
      args: ['@e4'],
      reason: 'Click product-card Add to Cart button',
    }),
    ['click', '@e4'],
  );
  assert.deepEqual(
    agentBrowserCommandArgs('http://127.0.0.1:5173', {
      kind: 'agentBrowserCommand',
      command: 'fill',
      args: ['@e2', 'shirt'],
      reason: 'Search for shirts',
    }),
    ['fill', '@e2', 'shirt'],
  );
  assert.deepEqual(
    agentBrowserCommandArgs('http://127.0.0.1:5173', {
      kind: 'agentBrowserCommand',
      command: 'press',
      args: ['Enter'],
      reason: 'Submit search input',
    }),
    ['press', 'Enter'],
  );
});

test('agentBrowserCommandArgs resolves open paths against baseUrl and blocks external origins', () => {
  assert.deepEqual(
    agentBrowserCommandArgs('http://127.0.0.1:5173', {
      kind: 'agentBrowserCommand',
      command: 'open',
      args: ['/products'],
      reason: 'Open products route',
    }),
    ['open', 'http://127.0.0.1:5173/products'],
  );

  assert.throws(
    () => agentBrowserCommandArgs('http://127.0.0.1:5173', {
      kind: 'agentBrowserCommand',
      command: 'open',
      args: ['https://example.com'],
      reason: 'External navigation',
    }),
    /External navigation is not allowed/,
  );
});

test('validateAgentBrowserCommand rejects unsafe or unsupported commands', () => {
  assert.throws(
    () => validateAgentBrowserCommand({
      kind: 'agentBrowserCommand',
      command: 'eval',
      args: ['window.localStorage.clear()'],
      reason: 'Clear state',
    }),
    /Command "eval" is not allowed/,
  );
  assert.throws(
    () => validateAgentBrowserCommand({
      kind: 'agentBrowserCommand',
      command: 'network',
      args: ['route', '**/*', '--abort'],
      reason: 'Block network',
    }),
    /Command "network" is not allowed/,
  );
  assert.throws(
    () => validateAgentBrowserCommand({
      kind: 'agentBrowserCommand',
      command: 'screenshot',
      args: ['/tmp/custom.png'],
      reason: 'Write custom screenshot path',
    }),
    /screenshot does not accept custom paths/,
  );
});

test('validateAgentBrowserCommand rejects unsafe flags and wait functions', () => {
  assert.throws(
    () => validateAgentBrowserCommand({
      kind: 'agentBrowserCommand',
      command: 'click',
      args: ['@e1', '--new-tab'],
      reason: 'Open outside app',
    }),
    /click flag "--new-tab" is not allowed/,
  );
  assert.throws(
    () => validateAgentBrowserCommand({
      kind: 'agentBrowserCommand',
      command: 'wait',
      args: ['--fn', 'window.ready === true'],
      reason: 'Wait for JS condition',
    }),
    /wait --fn is not allowed/,
  );
  assert.deepEqual(
    agentBrowserCommandArgs('http://127.0.0.1:5173', {
      kind: 'agentBrowserCommand',
      command: 'wait',
      args: ['--load', 'networkidle'],
      reason: 'Wait after navigation',
    }),
    ['wait', '--load', 'networkidle'],
  );
});

test('same-origin helpers identify state-changing commands and reject external URLs', () => {
  assert.equal(shouldVerifySameOriginAfterCommand({
    kind: 'agentBrowserCommand',
    command: 'click',
    args: ['@e1'],
    reason: 'Click link',
  }), true);
  assert.equal(shouldVerifySameOriginAfterCommand({
    kind: 'agentBrowserCommand',
    command: 'get',
    args: ['url'],
    reason: 'Read URL',
  }), false);
  assert.doesNotThrow(() => assertSameOriginUrl('http://127.0.0.1:5173', 'http://127.0.0.1:5173/products'));
  assert.throws(
    () => assertSameOriginUrl('http://127.0.0.1:5173', 'https://example.com/'),
    /External navigation is not allowed/,
  );
});

test('isExecutableAgentBrowserCommand separates browser commands from semantic verdicts', () => {
  assert.equal(isExecutableAgentBrowserCommand({ kind: 'agentBrowserCommand', command: 'scroll', args: ['down', '500'], reason: 'Reveal product cards' }), true);
  assert.equal(isExecutableAgentBrowserCommand({ kind: 'stepComplete', stepIndex: 0, note: 'done' }), false);
});
