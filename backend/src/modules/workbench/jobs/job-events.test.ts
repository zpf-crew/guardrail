import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkbenchJobEventBus, formatSse } from './job-events.js';
import type { WorkbenchJobEvent } from '../workbench.types.js';

const event: WorkbenchJobEvent = {
  type: 'progress',
  jobId: 'job-1',
  step: 'isolation',
  message: 'Loaded repo context',
};

test('job event bus subscribe and publish delivers event', () => {
  const bus = new WorkbenchJobEventBus();
  const received: WorkbenchJobEvent[] = [];

  bus.subscribe('session-1', delivered => received.push(delivered));
  bus.publish('session-1', event);

  assert.deepEqual(received, [event]);
});

test('job event bus unsubscribe stops delivery', () => {
  const bus = new WorkbenchJobEventBus();
  const received: WorkbenchJobEvent[] = [];
  const unsubscribe = bus.subscribe('session-1', delivered => received.push(delivered));

  unsubscribe();
  bus.publish('session-1', event);

  assert.deepEqual(received, []);
});

test('job event bus continues publishing when one listener throws', () => {
  const bus = new WorkbenchJobEventBus();
  const received: string[] = [];

  bus.subscribe('session-1', () => {
    received.push('first');
  });
  bus.subscribe('session-1', () => {
    received.push('throwing');
    throw new Error('listener failed');
  });
  bus.subscribe('session-1', () => {
    received.push('third');
  });

  assert.doesNotThrow(() => bus.publish('session-1', event));
  assert.deepEqual(received, ['first', 'throwing', 'third']);
});

test('formatSse serializes a workbench event', () => {
  assert.equal(
    formatSse(event),
    `event: progress\ndata: ${JSON.stringify(event)}\n\n`,
  );
});
