import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkbenchJobQueue } from './job-queue.js';

test('job queue marks a timed-out job as timeout and emits retryable error', async () => {
  const events: string[] = [];
  const queue = new WorkbenchJobQueue({ concurrency: 1 });

  await queue.enqueue({
    timeoutMs: 5,
    onStatus: status => events.push(status),
    onError: message => events.push(message),
    run: async signal => {
      await new Promise<void>(resolve => setTimeout(resolve, 20));
      if (signal.aborted) throw new Error('aborted by timeout');
    },
  });

  assert.deepEqual(events, ['queued', 'running', 'timeout', 'aborted by timeout']);
});
