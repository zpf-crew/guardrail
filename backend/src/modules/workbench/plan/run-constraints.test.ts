import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_STEP_DURATION_MS,
  DEFAULT_MAX_STEPS,
  buildDefaultRunConstraints,
  lookupRunConstraints,
  inferHeavyRunConstraints,
  mergeRunConstraintOverrides,
} from './run-constraints.js';

test('buildDefaultRunConstraints seeds one entry per behavior', () => {
  const result = buildDefaultRunConstraints(['Hero visible', 'Checkout flow']);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.maxStepDurationMs, DEFAULT_MAX_STEP_DURATION_MS);
  assert.equal(result[0]?.maxSteps, DEFAULT_MAX_STEPS);
});

test('inferHeavyRunConstraints extends checkout behavior per-step budget', () => {
  const defaults = buildDefaultRunConstraints(['Checkout with 3DS']);
  const merged = inferHeavyRunConstraints(defaults);
  const checkout = merged.find(item => item.behavior.includes('Checkout'));
  assert.equal(checkout?.maxStepDurationMs, 120_000);
  assert.equal(checkout?.maxSteps, 25);
  assert.ok(checkout?.reason);
});

test('mergeRunConstraintOverrides lets plan model customize a behavior budget', () => {
  const defaults = buildDefaultRunConstraints(['Checkout with 3DS']);
  const merged = mergeRunConstraintOverrides(defaults, [{
    behavior: 'Checkout with 3DS',
    maxStepDurationMs: 120_000,
    maxSteps: 30,
    reason: 'External challenge flow',
  }]);

  assert.equal(merged[0]?.maxStepDurationMs, 120_000);
  assert.equal(merged[0]?.maxSteps, 30);
  assert.match(merged[0]?.reason ?? '', /challenge/);
});

test('lookupRunConstraints falls back to default', () => {
  const list = buildDefaultRunConstraints(['Hero visible']);
  const found = lookupRunConstraints(list, 'Missing behavior');
  assert.equal(found.maxStepDurationMs, DEFAULT_MAX_STEP_DURATION_MS);
});
