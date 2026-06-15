import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelClient } from './model-client.js';
import { ModelClientError } from './model-errors.js';

function clientWithFetch(fetchImpl: typeof fetch) {
  return new ModelClient({
    baseUrl: 'http://llm.local',
    apiKey: 'key',
    chatPath: 'chat/completions',
    model: 'coder-model',
    profile: 'coder',
    fetchImpl,
  });
}

function response(status: number, body: unknown, statusText = 'status'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  } as Response;
}

test('model client classifies missing assistant content as retryable content error', async () => {
  const client = clientWithFetch(async () => response(200, { choices: [{ message: {} }] }) as never);

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'Return JSON.' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.equal(error.code, 'model_content_empty');
      assert.equal(error.retryable, true);
      assert.match(error.message, /assistant content/);
      return true;
    },
  );
});

test('model client classifies 429 as retryable HTTP error', async () => {
  const client = clientWithFetch(async () => response(429, { error: { message: 'rate limited' } }, 'Too Many Requests') as never);

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'Return JSON.' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.equal(error.code, 'model_http_429');
      assert.equal(error.retryable, true);
      assert.match(error.message, /429/);
      return true;
    },
  );
});

test('model client classifies 401 as non-retryable auth error', async () => {
  const client = clientWithFetch(async () => response(401, { error: { message: 'bad key' } }, 'Unauthorized') as never);

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'Return JSON.' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.equal(error.code, 'model_auth_failed');
      assert.equal(error.retryable, false);
      return true;
    },
  );
});

test('model client classifies missing config as non-retryable', async () => {
  const client = new ModelClient({
    baseUrl: '',
    apiKey: 'key',
    chatPath: 'chat/completions',
    model: 'coder-model',
    profile: 'coder',
  });

  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'Return JSON.' }]),
    (error: unknown) => {
      assert.ok(error instanceof ModelClientError);
      assert.equal(error.code, 'model_config_missing');
      assert.equal(error.retryable, false);
      return true;
    },
  );
});
