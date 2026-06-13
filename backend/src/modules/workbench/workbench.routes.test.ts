import test from 'node:test';
import assert from 'node:assert/strict';
import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Pool } from 'pg';
import { buildApp } from '../../app.js';
import { SESSION_COOKIE } from '../auth/session.service.js';
import { UiBrowserAdapter } from './adapters/ui-browser/ui-browser.adapter.js';
import { WorkbenchArtifactStore } from './artifacts/workbench-artifact-store.js';
import { WorkbenchJobEventBus } from './jobs/job-events.js';
import { WorkbenchJobQueue } from './jobs/job-queue.js';
import { WorkbenchJobStore } from './jobs/job-store.js';
import { ClonedRepoRepositoryProvider } from './repositories/cloned-repo-repository-provider.js';
import { LocalGuardrailRepositoryProvider } from './repositories/local-guardrail-repository-provider.js';
import type { RepositoryContextProvider } from './repositories/repository-context-provider.js';
import { buildWorkbenchRoutes } from './workbench.routes.js';
import { WorkbenchService, type WorkbenchServiceTestHooks } from './workbench.service.js';
import type { WorkbenchJobEvent, WorkbenchJobStatus } from './workbench.types.js';
import type { WorkbenchSchemaName } from './validation/workbench-validators.js';

type Snapshot = {
  job: { status: WorkbenchJobStatus; error?: string };
  events: WorkbenchJobEvent[];
  session: {
    repo: { name: string; path: string; branch: string };
    intent: {
      prompt: string;
      testTypes: string[];
    };
    steps: Record<string, string>;
    isolation?: {
      target: { feature: string };
      sourceFiles: Array<{ path: string }>;
    };
    run?: {
      ui: {
        outcome: string;
        command?: string;
        evidence: Array<{ href?: string }>;
      };
      matrix: Array<{ file: string }>;
      attention?: {
        kind: string;
        reason: string;
      };
    };
  };
};

const modelOutputs = {
  IsolationClassifications: {
    classifications: [{
      behavior: 'Complete onboarding with selected repository',
      status: 'Missing',
      suggestedTypes: ['UI / Browser'],
      risk: 'High',
      explanation: 'No browser evidence found in scanned repo context.',
    }],
  },
  TestPlanQuestions: { questions: [] },
  GenerationChanges: {
    changes: [{
      id: 'ui-browser-onboarding',
      action: 'Add',
      testType: 'UI / Browser',
      title: 'Complete onboarding with selected repository',
      file: 'guardrail-tests/ui/onboarding.feature',
      feature: 'Onboarding',
      risk: 'High',
      reason: 'Browser-level onboarding coverage is missing.',
      diff: [
        { kind: 'add', text: 'Feature: Guardrail onboarding' },
        { kind: 'add', text: '  Scenario: Complete onboarding with selected repository' },
        { kind: 'add', text: '    Given the user opens Guardrail onboarding' },
        { kind: 'add', text: '    When the user continues' },
        { kind: 'add', text: '    Then scan progress is visible' },
      ],
      status: 'staged',
    }],
  },
  ReviewRecommendation: {
    recommendation: 'Apply after reviewer accepts evidence.',
  },
} as const;

const TEST_SESSION_ID = 'test-session-id';
const TEST_USER_ID = 'user-1';
const TEST_REPO_ID = 'guardrail';
const FIXTURE_REPO_ID = 'acme-app-repo';
const FIXTURE_REPO_NAME = 'acme-app';

function authInjectOptions(): { cookies: Record<string, string> } {
  return { cookies: { [SESSION_COOKIE]: TEST_SESSION_ID } };
}

interface MockDbOptions {
  repoId?: string;
  repoName?: string;
  fullName?: string;
  clonePath?: string;
}

function createMockDb(clonePath: string, options: MockDbOptions = {}): Pool {
  const repoId = options.repoId ?? TEST_REPO_ID;
  const repoName = options.repoName ?? 'guardrail';
  const fullName = options.fullName ?? `org/${repoName}`;
  const repoRow = {
    id: repoId,
    github_repo_id: 1,
    full_name: fullName,
    name: repoName,
    private: false,
    default_branch: 'main',
    clone_url: `https://github.com/${fullName}.git`,
    html_url: `https://github.com/${fullName}`,
    clone_path: options.clonePath ?? clonePath,
    current_branch: 'test',
    commit_sha: 'abc123',
    status: 'cloned',
  };

  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM sessions s')) {
        return { rows: params?.[0] === TEST_SESSION_ID ? [{
          id: TEST_USER_ID,
          github_id: 1,
          login: 'test',
          name: null,
          avatar_url: null,
        }] : [] };
      }
      if (sql.includes('FROM repos WHERE id')) {
        return {
          rows: params?.[0] === repoId && params?.[1] === TEST_USER_ID ? [repoRow] : [],
        };
      }
      if (sql.includes('onboarding_scan_results')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
}

function createFakeStructuredModel(
  outputs: Partial<Record<WorkbenchSchemaName, unknown>> = modelOutputs,
): WorkbenchServiceTestHooks['structuredModel'] {
  return {
    runStep: async ({ schemaName }: { schemaName: WorkbenchSchemaName }) => {
      const output = outputs[schemaName];
      if (output === undefined) {
        throw new Error(`No fake model output configured for ${schemaName}`);
      }
      return structuredClone(output);
    },
  } as WorkbenchServiceTestHooks['structuredModel'];
}

test('workbench session creation requires auth', async () => {
  const app = buildApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/workbench/sessions',
    payload: { repoId: 'any', intent: { prompt: 'test', testTypes: ['UI / Browser'] } },
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('workbench routes create session, start analyze job, and expose job events', async () => {
  const app = await buildRouteTestApp();

  const session = await createSession(app);

  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  assert.equal(job.step, 'isolation');

  await new Promise(resolve => setTimeout(resolve, 20));
  const snapshotRes = await app.inject({
    method: 'GET',
    url: `/api/workbench/${session.id}/jobs/${job.jobId}`,
    ...authInjectOptions(),
  });
  assert.equal(snapshotRes.statusCode, 200);
  assert.ok(snapshotRes.json().events.length >= 1);
});

test('workbench routes return 404 for missing session and job', async () => {
  const app = await buildRouteTestApp();
  const session = await createSession(app);

  const missingSessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/missing-session/analyze/jobs',
    ...authInjectOptions(),
  });
  assert.equal(missingSessionRes.statusCode, 404);

  const missingJobRes = await app.inject({
    method: 'GET',
    url: `/api/workbench/${session.id}/jobs/missing-job`,
    ...authInjectOptions(),
  });
  assert.equal(missingJobRes.statusCode, 404);
});

test('workbench routes return 404 for missing artifact under existing session', async () => {
  const app = await buildRouteTestApp();
  const session = await createSession(app);

  const missingRes = await app.inject({
    method: 'GET',
    url: `/api/workbench/${session.id}/artifacts/missing.png`,
    ...authInjectOptions(),
  });

  assert.equal(missingRes.statusCode, 404);
});

test('workbench run job emits screenshot event with served artifact URL', async () => {
  const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-screenshot-'));
  const screenshotPath = path.join(screenshotDir, 'onboarding-progress.png');
  const loadedScreenshotPath = path.join(screenshotDir, 'onboarding-loaded.png');
  await writeFile(screenshotPath, Buffer.from('fake-png-progress'));
  await writeFile(loadedScreenshotPath, Buffer.from('fake-png-loaded'));

  const artifactRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const app = await buildArtifactRouteTestApp(screenshotPath, loadedScreenshotPath, artifactRoot, screenshotDir);
  const session = await createSession(app);

  const analyzeJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  })).json();
  const analyzeSnapshot = await waitForJob(app, session.id, analyzeJob.jobId, ['succeeded']);
  assert.equal(analyzeSnapshot.session.isolation?.target.feature, 'Checkout');
  assert.ok(analyzeSnapshot.session.isolation?.sourceFiles[0]?.path.includes('CheckoutPage'));

  const planJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/plan/jobs`,
    ...authInjectOptions(),
  })).json();
  await waitForJob(app, session.id, planJob.jobId, ['succeeded']);

  const generateJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/generate/jobs`,
    ...authInjectOptions(),
  })).json();
  await waitForJob(app, session.id, generateJob.jobId, ['succeeded']);

  const runJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/run/jobs`,
    ...authInjectOptions(),
  })).json();
  const snapshot = await waitForJob(app, session.id, runJob.jobId, ['succeeded']);
  const screenshot = snapshot.events.find(event => event.type === 'screenshot');

  assert.equal(snapshot.session.run?.ui.outcome, 'Passed');
  assert.ok((snapshot.session.run?.ui.evidence.length ?? 0) >= 2);
  assert.match(snapshot.session.run?.matrix[0]?.file ?? '', /onboarding\.feature/);

  assert.equal(screenshot?.type, 'screenshot');
  const artifactUrl = screenshot.type === 'screenshot' ? screenshot.artifact.href ?? '' : '';
  assert.match(artifactUrl, new RegExp(`^/api/workbench/${session.id}/artifacts/.+\\.png$`));
  assert.equal(snapshot.session.run?.ui.evidence[0]?.href, artifactUrl);

  const artifactRes = await app.inject({ method: 'GET', url: artifactUrl, ...authInjectOptions() });
  assert.equal(artifactRes.statusCode, 200);
  assert.match(String(artifactRes.headers['content-type']), /^image\/png/);

  const reviewJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/review/jobs`,
    ...authInjectOptions(),
  })).json();
  const reviewSnapshot = await waitForJob(app, session.id, reviewJob.jobId, ['succeeded']);
  assert.equal(reviewSnapshot.session.steps.review, 'done');
});

test('workbench status and error emit failures are contained in queue callbacks', async () => {
  const app = await buildStatusErrorEmitFailureTestApp();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);

  try {
    const session = await createSession(app);

    const analyzeJob = (await app.inject({
      method: 'POST',
      url: `/api/workbench/${session.id}/analyze/jobs`,
      ...authInjectOptions(),
    })).json();
    await waitForJob(app, session.id, analyzeJob.jobId, ['succeeded']);

    const failingSession = await createSession(app);
    const planJob = (await app.inject({
      method: 'POST',
      url: `/api/workbench/${failingSession.id}/plan/jobs`,
      ...authInjectOptions(),
    })).json();
    await waitForJob(app, failingSession.id, planJob.jobId, ['failed']);

    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('workbench routes allow browser clients from the frontend origin', async () => {
  const app = await buildRouteTestApp();

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
    ...authInjectOptions(),
    payload: {
      repoId: TEST_REPO_ID,
      intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] },
    },
  });
  assert.equal(sessionRes.statusCode, 200);
  assert.equal(sessionRes.headers['access-control-allow-origin'], '*');

  const session = sessionRes.json();
  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    headers: { origin: 'http://127.0.0.1:5173' },
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  await waitForJob(app, session.id, job.jobId, ['succeeded']);

  const eventsRes = await withTimeout(
    app.inject({
      method: 'GET',
      url: `/api/workbench/${session.id}/jobs/${job.jobId}/events`,
      headers: { origin: 'http://127.0.0.1:5173' },
    ...authInjectOptions(),
    }),
    500,
  );
  assert.equal(eventsRes.statusCode, 200);
  assert.notEqual(eventsRes.headers['access-control-allow-origin'], '*');
  assert.equal(eventsRes.headers['access-control-allow-credentials'], 'true');
  assert.equal(eventsRes.headers['content-type'], 'text/event-stream');
});

test('workbench routes update session intent before starting jobs', async () => {
  const app = await buildRouteTestApp();
  const session = await createSession(app);

  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/workbench/${session.id}`,
    headers: { origin: 'http://127.0.0.1:5173' },
    ...authInjectOptions(),
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

  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['succeeded']);
  assert.equal(snapshot.session.intent.prompt, 'Add UI Browser tests for onboarding repository selection');
  assert.deepEqual(snapshot.session.intent.testTypes, ['UI / Browser']);
});

test('workbench plan job without isolation fails and marks the step warn', async () => {
  const app = await buildRouteTestApp();
  const session = await createSession(app);

  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/plan/jobs`,
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['failed']);

  assert.equal(snapshot.job.status, 'failed');
  assert.match(snapshot.job.error ?? '', /Cannot plan before isolation/);
  assert.equal(snapshot.session.steps.plan, 'warn');
  assert.ok(snapshot.events.some(event => event.type === 'error' && /Cannot plan before isolation/.test(event.message)));
});

test('successful analyze job records ordered status progress result and succeeded events', async () => {
  const app = await buildRouteTestApp();
  const session = await createSession(app);

  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['succeeded']);
  const eventTypes = snapshot.events.map(event => event.type);

  assert.deepEqual(eventTypes.slice(0, 2), ['status', 'status']);
  assert.ok(snapshot.events.some(event => event.type === 'progress' && /Walking repository file tree/i.test(event.message)));
  assert.ok(snapshot.events.some(event => event.type === 'result'));
  const finalEvent = snapshot.events.at(-1);
  assert.equal(finalEvent?.type, 'status');
  assert.equal(finalEvent.type === 'status' ? finalEvent.status : undefined, 'succeeded');
  assert.equal(snapshot.session.steps.isolation, 'done');
});

test('workbench routes bind session repo from authenticated user clone fixture', async () => {
  const cloneRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-clone-fixture-'));
  const homePath = path.join(cloneRoot, 'frontend', 'src', 'pages', 'Home.tsx');
  await mkdir(path.dirname(homePath), { recursive: true });
  await writeFile(homePath, 'export default function Home() {}');

  const db = createMockDb(cloneRoot, {
    repoId: FIXTURE_REPO_ID,
    repoName: FIXTURE_REPO_NAME,
    fullName: 'acme/acme-app',
    clonePath: cloneRoot,
  });
  const app = await buildWorkbenchRouteTestApp({
    db,
    rootDir: cloneRoot,
    repositoryProvider: ClonedRepoRepositoryProvider.fromDb(db),
  });

  const session = await createSession(app, FIXTURE_REPO_ID);
  assert.equal(session.repo.name, FIXTURE_REPO_NAME);
  assert.notEqual(session.repo.name, 'guardrail');

  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();

  const snapshot = await waitForJob(app, session.id, job.jobId, ['succeeded']);
  assert.equal(snapshot.session.repo.name, FIXTURE_REPO_NAME);
  assert.notEqual(snapshot.session.repo.name, 'guardrail');
  assert.equal(snapshot.session.repo.path, cloneRoot);

  await app.close();
});

test('workbench run job reports failed UI outcome when dev server cannot be resolved', async () => {
  const app = await buildWorkbenchRouteTestApp({
    devServer: {
      resolve: async () => null,
      start: async () => {
        throw new Error('dev server start should not be called when resolve returns null');
      },
      stop: async () => {},
    },
  });
  const session = await createSession(app);

  const analyzeJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  })).json();
  await waitForJob(app, session.id, analyzeJob.jobId, ['succeeded']);

  const planJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/plan/jobs`,
    ...authInjectOptions(),
  })).json();
  await waitForJob(app, session.id, planJob.jobId, ['succeeded']);

  const generateJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/generate/jobs`,
    ...authInjectOptions(),
  })).json();
  await waitForJob(app, session.id, generateJob.jobId, ['succeeded']);

  const runJob = (await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/run/jobs`,
    ...authInjectOptions(),
  })).json();
  const snapshot = await waitForJob(app, session.id, runJob.jobId, ['succeeded']);

  assert.equal(snapshot.job.status, 'succeeded');
  assert.equal(snapshot.session.run?.ui.outcome, 'Failed');
  assert.equal(snapshot.session.run?.attention?.kind, 'failed');
  assert.match(snapshot.session.run?.attention?.reason ?? '', /dev server/i);
  assert.match(snapshot.session.run?.ui.command ?? '', /dev server unavailable/i);

  await app.close();
});

test('workbench SSE replays existing events through terminal event and closes', async () => {
  const app = await buildRouteTestApp();
  const session = await createSession(app);

  const jobRes = await app.inject({
    method: 'POST',
    url: `/api/workbench/${session.id}/analyze/jobs`,
    ...authInjectOptions(),
  });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  await waitForJob(app, session.id, job.jobId, ['succeeded']);

  const eventsRes = await withTimeout(
    app.inject({
      method: 'GET',
      url: `/api/workbench/${session.id}/jobs/${job.jobId}/events`,
      ...authInjectOptions(),
    }),
    500,
  );

  assert.equal(eventsRes.statusCode, 200);
  assert.equal(eventsRes.headers['content-type'], 'text/event-stream');
  assert.match(eventsRes.payload, /event: result/);
  assert.match(eventsRes.payload, /"status":"succeeded"/);
});

async function buildRouteTestApp(): Promise<FastifyInstance> {
  return buildWorkbenchRouteTestApp();
}

async function buildWorkbenchRouteTestApp(options: {
  runner?: NonNullable<NonNullable<ConstructorParameters<typeof UiBrowserAdapter>[0]>['runner']>;
  devServer?: NonNullable<ConstructorParameters<typeof UiBrowserAdapter>[0]>['devServer'];
  artifactStore?: WorkbenchArtifactStore;
  eventBus?: WorkbenchJobEventBus;
  testHooks?: WorkbenchServiceTestHooks;
  repositoryProvider?: RepositoryContextProvider;
  db?: Pool;
  rootDir?: string;
} = {}): Promise<FastifyInstance> {
  const app = Fastify();
  const rootDir = options.rootDir
    ?? (path.basename(process.cwd()) === 'backend' ? path.dirname(process.cwd()) : process.cwd());
  const db = options.db ?? createMockDb(rootDir);

  await app.register(cookie);
  app.decorate('db', db);

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
  });

  app.options('*', async (_request, reply) => {
    return reply.code(204).send();
  });

  const repositoryProvider = options.repositoryProvider
    ?? new LocalGuardrailRepositoryProvider({ rootDir });
  const uiBrowserOptions: ConstructorParameters<typeof UiBrowserAdapter>[0] = {};
  if (options.runner) uiBrowserOptions.runner = options.runner;
  if (options.devServer) uiBrowserOptions.devServer = options.devServer;

  const service = new WorkbenchService(
    new WorkbenchJobStore(),
    new WorkbenchJobQueue({ concurrency: 1 }),
    options.eventBus ?? new WorkbenchJobEventBus(),
    options.artifactStore ?? new WorkbenchArtifactStore(),
    repositoryProvider,
    [new UiBrowserAdapter(uiBrowserOptions)],
    options.testHooks ?? { structuredModel: createFakeStructuredModel() },
  );

  await app.register(buildWorkbenchRoutes(service), { prefix: '/api/workbench' });
  return app;
}

async function buildArtifactRouteTestApp(
  screenshotPath: string,
  loadedScreenshotPath: string,
  artifactRoot: string,
  screenshotRoot: string,
): Promise<FastifyInstance> {
  return buildWorkbenchRouteTestApp({
    artifactStore: new WorkbenchArtifactStore({ rootDir: artifactRoot, allowedSourceRoots: [screenshotRoot] }),
    devServer: stubDevServer(),
    runner: {
      async run() {
        return {
          outcome: 'Passed',
          durationMs: 25,
          evidence: [
            { kind: 'screenshot', label: 'Onboarding page loaded', href: loadedScreenshotPath },
            { kind: 'screenshot', label: 'Onboarding progress evidence', href: screenshotPath },
          ],
        };
      },
    },
  });
}

function stubDevServer(): NonNullable<ConstructorParameters<typeof UiBrowserAdapter>[0]>['devServer'] {
  return {
    resolve: async () => ({
      kind: 'subprocess',
      command: 'pnpm',
      args: ['dev'],
      cwd: '/tmp',
      port: 5555,
      healthPath: '/',
    }),
    start: async (_target, _signal, route = '/') => ({
      baseUrl: 'http://127.0.0.1:5555',
      route,
      stop: async () => {},
    }),
    stop: async lease => { await lease.stop(); },
  };
}

async function buildStatusErrorEmitFailureTestApp(): Promise<FastifyInstance> {
  return buildWorkbenchRouteTestApp({
    eventBus: new ThrowingStatusErrorEventBus(),
  });
}

async function createSession(app: FastifyInstance, repoId = TEST_REPO_ID) {
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/sessions',
    ...authInjectOptions(),
    payload: {
      repoId,
      intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] },
    },
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
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const snapshotRes = await app.inject({
      method: 'GET',
      url: `/api/workbench/${sessionId}/jobs/${jobId}`,
      ...authInjectOptions(),
    });
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

class ThrowingStatusErrorEventBus extends WorkbenchJobEventBus {
  override publish(key: string, event: WorkbenchJobEvent): void {
    if (event.type === 'status' || event.type === 'error') {
      throw new Error(`publish failed for ${event.type}`);
    }
    super.publish(key, event);
  }
}
