import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage, ChatOptions } from '../../model-connect/model-connect.types.js';
import { ModelClientError } from '../../model-connect/model-errors.js';
import { runReliableStructuredModel } from './reliable-model-runner.js';

function fakeClient(sequence: Array<{ content: string } | Error>) {
  let calls = 0;
  const messages: ChatMessage[][] = [];
  return {
    client: {
      chat: async (nextMessages: ChatMessage[], _options: ChatOptions) => {
        messages.push(nextMessages);
        const next = sequence[Math.min(calls++, sequence.length - 1)]!;
        if (next instanceof Error) throw next;
        return next;
      },
    },
    get calls() {
      return calls;
    },
    messages,
  };
}

test('retries missing assistant content and succeeds', async () => {
  const fake = fakeClient([
    new ModelClientError({
      code: 'model_content_empty',
      message: 'LLM response did not contain assistant content',
      retryable: true,
    }),
    { content: '{"value":42}' },
  ]);

  const result = await runReliableStructuredModel({
    client: fake.client as never,
    messagesForAttempt: () => [{ role: 'user', content: 'Return JSON.' }],
    chatOptions: { temperature: 0, maxTokens: 100 },
    signal: new AbortController().signal,
    validate: value => value as { value: number },
    delaysMs: [0, 0],
  });

  assert.deepEqual(result, { value: 42 });
  assert.equal(fake.calls, 2);
});

test('does not retry non-retryable auth failure', async () => {
  const fake = fakeClient([
    new ModelClientError({
      code: 'model_auth_failed',
      message: 'LLM request failed (401): bad key',
      retryable: false,
      status: 401,
    }),
  ]);

  await assert.rejects(
    () =>
      runReliableStructuredModel({
        client: fake.client as never,
        messagesForAttempt: () => [{ role: 'user', content: 'Return JSON.' }],
        chatOptions: { temperature: 0, maxTokens: 100 },
        signal: new AbortController().signal,
        validate: value => value,
        delaysMs: [0, 0],
      }),
    /model_auth_failed after 1 attempt/,
  );
  assert.equal(fake.calls, 1);
});

test('retries invalid JSON with validation error prompt', async () => {
  const fake = fakeClient([
    { content: 'not json' },
    { content: '{"ok":true}' },
  ]);

  const result = await runReliableStructuredModel({
    client: fake.client as never,
    messagesForAttempt: error => [
      {
        role: 'user',
        content: JSON.stringify(error
          ? { schemaName: 'Example', validationError: error, retryHint: 'Return JSON only.' }
          : { schemaName: 'Example' }),
      },
    ],
    chatOptions: { temperature: 0, maxTokens: 100 },
    signal: new AbortController().signal,
    validate: value => value as { ok: boolean },
    delaysMs: [0, 0],
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(fake.calls, 2);
  assert.match(fake.messages[1]![0]!.content, /validationError/);
});

test('preserves abort without retrying', async () => {
  const controller = new AbortController();
  controller.abort();
  const fake = fakeClient([{ content: '{"ok":true}' }]);

  await assert.rejects(
    () =>
      runReliableStructuredModel({
        client: fake.client as never,
        messagesForAttempt: () => [{ role: 'user', content: 'Return JSON.' }],
        chatOptions: { temperature: 0, maxTokens: 100 },
        signal: controller.signal,
        validate: value => value,
        delaysMs: [0, 0],
      }),
    /aborted|Abort/i,
  );
  assert.equal(fake.calls, 0);
});
