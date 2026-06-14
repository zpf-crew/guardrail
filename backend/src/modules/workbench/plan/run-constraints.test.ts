import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_MAX_STEPS,
  buildDefaultRunConstraints,
  lookupRunConstraints,
  inferHeavyRunConstraints,
} from './run-constraints.js';

test('buildDefaultRunConstraints seeds one entry per behavior', () => {
  const result = buildDefaultRunConstraints(['Hero visible', 'Checkout flow']);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.maxDurationMs, DEFAULT_MAX_DURATION_MS);
  assert.equal(result[0]?.maxSteps, DEFAULT_MAX_STEPS);
});

test('inferHeavyRunConstraints extends checkout behavior to 5 minutes', () => {
  const defaults = buildDefaultRunConstraints(['Checkout with 3DS']);
  const merged = inferHeavyRunConstraints(defaults);
  const checkout = merged.find(item => item.behavior.includes('Checkout'));
  assert.equal(checkout?.maxDurationMs, 300_000);
  assert.equal(checkout?.maxSteps, 25);
  assert.ok(checkout?.reason);
});

test('lookupRunConstraints falls back to default', () => {
  const list = buildDefaultRunConstraints(['Hero visible']);
  const found = lookupRunConstraints(list, 'Missing behavior');
  assert.equal(found.maxDurationMs, DEFAULT_MAX_DURATION_MS);
});
