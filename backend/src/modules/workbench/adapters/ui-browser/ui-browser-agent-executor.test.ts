import test from 'node:test';
import assert from 'node:assert/strict';
import { agentCommandArgs, isSnapshotAction } from './ui-browser-agent-executor.js';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

test('agentCommandArgs maps click ref to agent-browser click', () => {
  const action: UiBrowserAgentAction = { kind: 'click', ref: '@e4' };
  assert.deepEqual(agentCommandArgs('http://127.0.0.1:5555', action), ['click', '@e4']);
});

test('agentCommandArgs maps open to full URL', () => {
  const action: UiBrowserAgentAction = { kind: 'open', path: '/products' };
  assert.deepEqual(
    agentCommandArgs('http://127.0.0.1:5555', action),
    ['open', 'http://127.0.0.1:5555/products'],
  );
});

test('isSnapshotAction is false for control actions', () => {
  assert.equal(isSnapshotAction({ kind: 'stepComplete', stepIndex: 0, note: 'ok' }), false);
});
