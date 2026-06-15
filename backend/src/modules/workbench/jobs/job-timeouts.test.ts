import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKBENCH_STEP_TIMEOUT_MS } from './job-timeouts.js';

test('generate allows five minutes for model fallback and validation retry', () => {
  assert.equal(WORKBENCH_STEP_TIMEOUT_MS.generate, 300_000);
});
