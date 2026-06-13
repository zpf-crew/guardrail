import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../app.js';
import type { WorkbenchJobEvent, WorkbenchJobStatus } from './workbench.types.js';

type Snapshot = {
  job: { status: WorkbenchJobStatus; error?: string };
  events: WorkbenchJobEvent[];
  session: { steps: Record<string, string> };
};

test('workbench routes create session, start analyze job, and expose job events', async () => {
  const app = buildApp();

  const session = await createSession(app);

  const jobRes = await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/analyze/jobs` });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  assert.equal(job.step, 'isolation');

  await new Promise(resolve => setTimeout(resolve, 20));
  const snapshotRes = await app.inject({ method: 'GET', url: `/api/workbench/${session.id}/jobs/${job.jobId}` });
  assert.equal(snapshotRes.statusCode, 200);
  assert.ok(snapshotRes.json().events.length >= 1);
});

test('workbench routes return 404 for missing session and job', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const missingSessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/missing-session/analyze/jobs',
  });
  assert.equal(missingSessionRes.statusCode, 404);

  const missingJobRes = await app.inject({
    method: 'GET',
    url: `/api/workbench/${session.id}/jobs/missing-job`,
  });
  assert.equal(missingJobRes.statusCode, 404);
});

test('workbench plan job without isolation fails and marks the step warn', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const jobRes = await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/plan/jobs` });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['failed']);

  assert.equal(snapshot.job.status, 'failed');
  assert.match(snapshot.job.error ?? '', /Cannot plan before isolation/);
  assert.equal(snapshot.session.steps.plan, 'warn');
  assert.ok(snapshot.events.some(event => event.type === 'error' && /Cannot plan before isolation/.test(event.message)));
});

test('successful analyze job records ordered status progress result and succeeded events', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const jobRes = await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/analyze/jobs` });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['succeeded']);
  const eventTypes = snapshot.events.map(event => event.type);

  assert.deepEqual(eventTypes.slice(0, 2), ['status', 'status']);
  assert.ok(snapshot.events.some(event => event.type === 'progress'));
  assert.ok(snapshot.events.some(event => event.type === 'result'));
  const finalEvent = snapshot.events.at(-1);
  assert.equal(finalEvent?.type, 'status');
  assert.equal(finalEvent.type === 'status' ? finalEvent.status : undefined, 'succeeded');
  assert.equal(snapshot.session.steps.isolation, 'done');
});

test('workbench SSE replays existing events through terminal event and closes', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const jobRes = await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/analyze/jobs` });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  await waitForJob(app, session.id, job.jobId, ['succeeded']);

  const eventsRes = await withTimeout(
    app.inject({ method: 'GET', url: `/api/workbench/${session.id}/jobs/${job.jobId}/events` }),
    500,
  );

  assert.equal(eventsRes.statusCode, 200);
  assert.equal(eventsRes.headers['content-type'], 'text/event-stream');
  assert.match(eventsRes.payload, /event: result/);
  assert.match(eventsRes.payload, /"status":"succeeded"/);
});

async function createSession(app: ReturnType<typeof buildApp>) {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/sessions',
    payload: { intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] } },
  });
  assert.equal(sessionRes.statusCode, 200);
  return sessionRes.json();
}

async function waitForJob(
  app: ReturnType<typeof buildApp>,
  sessionId: string,
  jobId: string,
  statuses: WorkbenchJobStatus[],
): Promise<Snapshot> {
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline) {
    const snapshotRes = await app.inject({ method: 'GET', url: `/api/workbench/${sessionId}/jobs/${jobId}` });
    assert.equal(snapshotRes.statusCode, 200);
    const snapshot = snapshotRes.json() as Snapshot;
    if (statuses.includes(snapshot.job.status)) return snapshot;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Timed out waiting for job ${jobId} to reach ${statuses.join(', ')}`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
