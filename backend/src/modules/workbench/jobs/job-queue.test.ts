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

test('job queue fails new jobs when pending queue is full', async () => {
  const events: string[] = [];
  const queue = new WorkbenchJobQueue({ concurrency: 1, maxPendingJobs: 1 });
  let releaseFirst!: () => void;

  const firstJob = queue.enqueue({
    timeoutMs: 0,
    onStatus: status => events.push(`first:${status}`),
    onError: message => events.push(`first:${message}`),
    run: async () => {
      await new Promise<void>(resolve => {
        releaseFirst = resolve;
      });
    },
  });
  const secondJob = queue.enqueue({
    timeoutMs: 0,
    onStatus: status => events.push(`second:${status}`),
    onError: message => events.push(`second:${message}`),
    run: async () => {
      events.push('second:run');
    },
  });
  await queue.enqueue({
    timeoutMs: 0,
    onStatus: status => events.push(`third:${status}`),
    onError: message => events.push(`third:${message}`),
    run: async () => {
      events.push('third:run');
    },
  });

  assert.deepEqual(events, [
    'first:queued',
    'first:running',
    'second:queued',
    'third:queued',
    'third:failed',
    'third:Workbench job queue is full. Try again later. Max pending jobs: 1.',
  ]);

  releaseFirst();
  await Promise.all([firstJob, secondJob]);
  assert.equal(events.includes('third:run'), false);
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

test('job queue continues when running status callback throws', async () => {
  const events: string[] = [];
  const queue = new WorkbenchJobQueue({ concurrency: 1 });

  const throwingStatus = queue.enqueue({
    timeoutMs: 0,
    onStatus: status => {
      events.push(`first:${status}`);
      if (status === 'running') throw new Error('status callback failed');
    },
    onError: message => events.push(`first:${message}`),
    run: async () => {
      events.push('first:run');
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

  await Promise.all([throwingStatus, nextJob]);

  assert.deepEqual(events, [
    'first:queued',
    'first:running',
    'first:run',
    'second:queued',
    'first:succeeded',
    'second:running',
    'second:run',
    'second:succeeded',
  ]);
});

test('job queue continues when late timeout error callback throws', async () => {
  const events: string[] = [];
  const queue = new WorkbenchJobQueue({ concurrency: 1 });

  const lateAbort = queue.enqueue({
    timeoutMs: 5,
    onStatus: status => events.push(`first:${status}`),
    onError: message => {
      events.push(`first:${message}`);
      throw new Error('error callback failed');
    },
    run: async signal => {
      await new Promise<void>(resolve => setTimeout(resolve, 80));
      if (signal.aborted) throw new Error('late error callback abort');
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
    'first:late error callback abort',
  ]);
});
