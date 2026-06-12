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

test('job queue frees concurrency when a timed-out job ignores abort', async () => {
  const events: string[] = [];
  const queue = new WorkbenchJobQueue({ concurrency: 1 });

  const ignoredAbort = queue.enqueue({
    timeoutMs: 5,
    onStatus: status => events.push(`first:${status}`),
    onError: message => events.push(`first:${message}`),
    run: async () => {
      await new Promise<void>(() => {});
    },
  });

  const nextJob = queue.enqueue({
    timeoutMs: 0,
    onStatus: status => events.push(`second:${status}`),
    onError: message => events.push(`second:${message}`),
    run: async () => {
      events.push('second:run');
    },
  });

  await Promise.all([ignoredAbort, nextJob]);

  assert.deepEqual(events, [
    'first:queued',
    'first:running',
    'second:queued',
    'first:timeout',
    'first:Job timed out after 5ms and was aborted',
    'second:running',
    'second:run',
    'second:succeeded',
  ]);
});

test('job queue frees concurrency before a late cooperative abort error is emitted', async () => {
  const events: string[] = [];
  const queue = new WorkbenchJobQueue({ concurrency: 1 });

  const lateAbort = queue.enqueue({
    timeoutMs: 5,
    onStatus: status => events.push(`first:${status}`),
    onError: message => events.push(`first:${message}`),
    run: async signal => {
      await new Promise<void>(resolve => setTimeout(resolve, 80));
      if (signal.aborted) throw new Error('late cooperative abort');
    },
  });

  const nextJob = queue.enqueue({
    timeoutMs: 0,
    onStatus: status => events.push(`second:${status}`),
    onError: message => events.push(`second:${message}`),
    run: async () => {
      events.push('second:run');
    },
  });

  await Promise.all([lateAbort, nextJob]);

  assert.deepEqual(events, [
    'first:queued',
    'first:running',
    'second:queued',
    'first:timeout',
    'first:Job timed out after 5ms and was aborted',
    'second:running',
    'second:run',
    'second:succeeded',
  ]);

  await new Promise<void>(resolve => setTimeout(resolve, 40));

  assert.deepEqual(events, [
    'first:queued',
    'first:running',
    'second:queued',
    'first:timeout',
    'first:Job timed out after 5ms and was aborted',
    'second:running',
    'second:run',
    'second:succeeded',
    'first:late cooperative abort',
  ]);
});
