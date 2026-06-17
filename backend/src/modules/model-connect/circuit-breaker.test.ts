import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from './circuit-breaker.js';

test('circuit breaker opens after failure threshold and resets after timeout', () => {
  let now = 0;
  const breaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeoutMs: 1_000,
    now: () => now,
  });

  assert.equal(breaker.isOpen(), false);
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), false);
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), true);

  now = 999;
  assert.equal(breaker.isOpen(), true);

  now = 1_000;
  assert.equal(breaker.isOpen(), false);
});

test('circuit breaker closes after success in half-open state', () => {
  let now = 0;
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeoutMs: 100,
    now: () => now,
  });

  breaker.recordFailure();
  assert.equal(breaker.isOpen(), true);

  now = 100;
  assert.equal(breaker.isOpen(), false);
  breaker.recordSuccess();
  assert.equal(breaker.isOpen(), false);
});

test('circuit breaker reopens when half-open attempt fails', () => {
  let now = 0;
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    resetTimeoutMs: 100,
    now: () => now,
  });

  breaker.recordFailure();
  now = 100;
  assert.equal(breaker.isOpen(), false);
  breaker.recordFailure();
  assert.equal(breaker.isOpen(), true);
});
