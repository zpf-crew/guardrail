import test from 'node:test';
import assert from 'node:assert/strict';
import { agentBrowserSessionArgs, agentCommandArgs, isSnapshotAction } from './ui-browser-agent-executor.js';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

test('agentCommandArgs maps command envelope to agent-browser argv', () => {
  const action: UiBrowserAgentAction = {
    kind: 'agentBrowserCommand',
    command: 'find',
    args: ['role', 'button', 'click', 'Add to Cart'],
    reason: 'Click Add to Cart by role/name',
  };
  assert.deepEqual(agentCommandArgs('http://127.0.0.1:5555', action), ['find', 'role', 'button', 'click', 'Add to Cart']);
});

test('agentCommandArgs maps open command envelope to same-origin URL', () => {
  const action: UiBrowserAgentAction = {
    kind: 'agentBrowserCommand',
    command: 'open',
    args: ['/products'],
    reason: 'Open products route',
  };
  assert.deepEqual(agentCommandArgs('http://127.0.0.1:5555', action), ['open', 'http://127.0.0.1:5555/products']);
});

test('isSnapshotAction is true for executable command envelope', () => {
  assert.equal(isSnapshotAction({ kind: 'agentBrowserCommand', command: 'scroll', args: ['down', '500'], reason: 'Reveal product controls' }), true);
  assert.equal(isSnapshotAction({ kind: 'stepComplete', stepIndex: 0, note: 'ok' }), false);
});

test('agentBrowserSessionArgs scopes commands to a browser session', () => {
  assert.deepEqual(
    agentBrowserSessionArgs('guardrail-run-1', ['open', 'http://127.0.0.1:5555/']),
    ['--session', 'guardrail-run-1', 'open', 'http://127.0.0.1:5555/'],
  );
});
