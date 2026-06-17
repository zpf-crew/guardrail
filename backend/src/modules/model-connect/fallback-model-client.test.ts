import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from './circuit-breaker.js';
import { FallbackModelClient } from './fallback-model-client.js';
import { ModelClient } from './model-client.js';
import { ModelClientError } from './model-errors.js';

function response(status: number, body: unknown, statusText = 'status'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  } as Response;
}

function clientWithFetch(
  profile: 'thinker' | 'coder',
  fetchImpl: typeof fetch,
  model = `${profile}-model`,
) {
  return new ModelClient({
    baseUrl: 'http://llm.local',
    apiKey: 'key',
    chatPath: 'chat/completions',
    model,
    profile,
    fetchImpl,
  });
}

test('fallback model client uses primary when primary succeeds', async () => {
  let calls = 0;
  const primary = clientWithFetch('thinker', async () => {
    calls += 1;
    return response(200, { choices: [{ message: { content: 'primary' } }] }) as never;
  });
  const fallback = clientWithFetch('thinker', async () => {
    calls += 1;
    return response(200, { choices: [{ message: { content: 'fallback' } }] }) as never;
  }, 'fallback-model');
  const client = new FallbackModelClient(primary, fallback, new CircuitBreaker());

  const result = await client.chat([{ role: 'user', content: 'hi' }]);
  assert.equal(result.content, 'primary');
  assert.equal(calls, 1);
});

test('fallback model client uses fallback when primary fails', async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const primary = clientWithFetch('coder', async () => {
    primaryCalls += 1;
    return response(503, { error: { message: 'down' } }, 'Service Unavailable') as never;
  });
  const fallback = clientWithFetch('coder', async () => {
    fallbackCalls += 1;
    return response(200, { choices: [{ message: { content: 'fallback ok' } }] }) as never;
  }, 'fallback-coder');
  const client = new FallbackModelClient(primary, fallback, new CircuitBreaker());

  const result = await client.chat([{ role: 'user', content: 'hi' }]);
  assert.equal(result.content, 'fallback ok');
  assert.equal(result.model, 'fallback-coder');
  assert.equal(primaryCalls, 1);
  assert.equal(fallbackCalls, 1);
});

test('fallback model client skips fallback when circuit is open', async () => {
  let fallbackCalls = 0;
  const primary = clientWithFetch('thinker', async () => response(503, { error: { message: 'down' } }) as never);
  const fallback = clientWithFetch('thinker', async () => {
    fallbackCalls += 1;
    return response(200, { choices: [{ message: { content: 'fallback ok' } }] }) as never;
  });
  const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 });
  breaker.recordFailure();
  const client = new FallbackModelClient(primary, fallback, breaker);

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'hi' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.match(error.message, /503/);
      return true;
    },
  );
  assert.equal(fallbackCalls, 0);
});

test('fallback model client does not fallback on abort', async () => {
  let fallbackCalls = 0;
  const primary = clientWithFetch('thinker', async () => {
    throw new DOMException('Aborted', 'AbortError');
  });
  const fallback = clientWithFetch('thinker', async () => {
    fallbackCalls += 1;
    return response(200, { choices: [{ message: { content: 'fallback ok' } }] }) as never;
  });
  const client = new FallbackModelClient(primary, fallback, new CircuitBreaker());

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'hi' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.equal(error.code, 'model_aborted');
      return true;
    },
  );
  assert.equal(fallbackCalls, 0);
});

test('fallback model client combines errors when both providers fail', async () => {
  const primary = clientWithFetch('thinker', async () => response(503, { error: { message: 'primary down' } }) as never);
  const fallback = clientWithFetch('thinker', async () => response(429, { error: { message: 'rate limited' } }, 'Too Many Requests') as never);
  const client = new FallbackModelClient(primary, fallback, new CircuitBreaker());

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'hi' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.match(error.message, /Primary provider failed/);
      assert.match(error.message, /fallback provider failed/);
      assert.equal(error.code, 'model_http_429');
      return true;
    },
  );
});
