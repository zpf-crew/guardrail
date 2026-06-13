import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../../app.js';
import { UiBrowserAdapter } from './adapters/ui-browser/ui-browser.adapter.js';
import { WorkbenchArtifactStore } from './artifacts/workbench-artifact-store.js';
import { WorkbenchJobEventBus } from './jobs/job-events.js';
import { WorkbenchJobQueue } from './jobs/job-queue.js';
import { WorkbenchJobStore } from './jobs/job-store.js';
import { LocalGuardrailRepositoryProvider } from './repositories/local-guardrail-repository-provider.js';
import { buildWorkbenchRoutes } from './workbench.routes.js';
import { WorkbenchService } from './workbench.service.js';
import type { WorkbenchJobEvent, WorkbenchJobStatus } from './workbench.types.js';

type Snapshot = {
  job: { status: WorkbenchJobStatus; error?: string };
  events: WorkbenchJobEvent[];
  session: {
    intent: {
      prompt: string;
      testTypes: string[];
    };
    steps: Record<string, string>;
    run?: {
      ui: {
        evidence: Array<{ href?: string }>;
      };
    };
  };
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

test('workbench routes return 404 for missing artifact under existing session', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const missingRes = await app.inject({
    method: 'GET',
    url: `/api/workbench/${session.id}/artifacts/missing.png`,
  });

  assert.equal(missingRes.statusCode, 404);
});

test('workbench run job emits screenshot event with served artifact URL', async () => {
  const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-screenshot-'));
  const screenshotPath = path.join(screenshotDir, 'onboarding.png');
  await writeFile(screenshotPath, Buffer.from('fake-png'));

  const artifactRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const app = await buildArtifactRouteTestApp(screenshotPath, artifactRoot, screenshotDir);
  const session = await createSession(app);

  const analyzeJob = (await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/analyze/jobs` })).json();
  await waitForJob(app, session.id, analyzeJob.jobId, ['succeeded']);

  const planJob = (await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/plan/jobs` })).json();
  await waitForJob(app, session.id, planJob.jobId, ['succeeded']);

  const generateJob = (await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/generate/jobs` })).json();
  await waitForJob(app, session.id, generateJob.jobId, ['succeeded']);

  const runJob = (await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/run/jobs` })).json();
  const snapshot = await waitForJob(app, session.id, runJob.jobId, ['succeeded']);
  const screenshot = snapshot.events.find(event => event.type === 'screenshot');

  assert.equal(screenshot?.type, 'screenshot');
  const artifactUrl = screenshot.type === 'screenshot' ? screenshot.artifact.href ?? '' : '';
  assert.match(artifactUrl, new RegExp(`^/api/workbench/${session.id}/artifacts/.+\\.png$`));
  assert.equal(snapshot.session.run?.ui.evidence[0]?.href, artifactUrl);

  const artifactRes = await app.inject({ method: 'GET', url: artifactUrl });
  assert.equal(artifactRes.statusCode, 200);
  assert.match(String(artifactRes.headers['content-type']), /^image\/png/);
});

test('workbench routes allow browser clients from the frontend origin', async () => {
  const app = buildApp();

  const optionsRes = await app.inject({
    method: 'OPTIONS',
    url: '/api/workbench/sessions',
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  assert.equal(optionsRes.statusCode, 204);
  assert.equal(optionsRes.headers['access-control-allow-origin'], '*');
  assert.match(String(optionsRes.headers['access-control-allow-methods']), /POST/);
  assert.match(String(optionsRes.headers['access-control-allow-methods']), /PATCH/);

  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/sessions',
    headers: { origin: 'http://127.0.0.1:5173' },
    payload: { intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] } },
  });
  assert.equal(sessionRes.statusCode, 200);
  assert.equal(sessionRes.headers['access-control-allow-origin'], '*');

  const session = sessionRes.json();
  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  await waitForJob(app, session.id, job.jobId, ['succeeded']);

  const eventsRes = await withTimeout(
    app.inject({
      method: 'GET',
      url: `/api/workbench/${session.id}/jobs/${job.jobId}/events`,
      headers: { origin: 'http://127.0.0.1:5173' },
    }),
    500,
  );
  assert.equal(eventsRes.statusCode, 200);
  assert.equal(eventsRes.headers['access-control-allow-origin'], '*');
  assert.equal(eventsRes.headers['content-type'], 'text/event-stream');
});

test('workbench routes update session intent before starting jobs', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/workbench/${session.id}`,
    headers: { origin: 'http://127.0.0.1:5173' },
    payload: {
      intent: {
        prompt: 'Add UI Browser tests for onboarding repository selection',
        feature: 'Checkout',
        testTypes: ['UI / Browser'],
        sources: ['Codebase'],
      },
    },
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.headers['access-control-allow-origin'], '*');
  assert.equal(updateRes.json().intent.prompt, 'Add UI Browser tests for onboarding repository selection');
  assert.deepEqual(updateRes.json().intent.testTypes, ['UI / Browser']);

  const jobRes = await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/analyze/jobs` });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['succeeded']);
  assert.equal(snapshot.session.intent.prompt, 'Add UI Browser tests for onboarding repository selection');
  assert.deepEqual(snapshot.session.intent.testTypes, ['UI / Browser']);
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

async function buildArtifactRouteTestApp(screenshotPath: string, artifactRoot: string, screenshotRoot: string): Promise<FastifyInstance> {
  const app = Fastify();
  const rootDir = path.basename(process.cwd()) === 'backend' ? path.dirname(process.cwd()) : process.cwd();

  const service = new WorkbenchService(
    new WorkbenchJobStore(),
    new WorkbenchJobQueue({ concurrency: 1 }),
    new WorkbenchJobEventBus(),
    new WorkbenchArtifactStore({ rootDir: artifactRoot, allowedSourceRoots: [screenshotRoot] }),
    new LocalGuardrailRepositoryProvider({ rootDir }),
    [
      new UiBrowserAdapter({
        runner: {
          async run() {
            return {
              outcome: 'Passed',
              durationMs: 25,
              evidence: [{ kind: 'screenshot', label: 'Onboarding screenshot', href: screenshotPath }],
            };
          },
        },
      }),
    ],
  );

  await app.register(buildWorkbenchRoutes(service), { prefix: '/api/workbench' });
  return app;
}

async function createSession(app: FastifyInstance) {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/sessions',
    payload: { intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] } },
  });
  assert.equal(sessionRes.statusCode, 200);
  return sessionRes.json();
}

async function waitForJob(
  app: FastifyInstance,
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
