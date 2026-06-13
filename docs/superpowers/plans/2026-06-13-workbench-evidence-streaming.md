# Workbench Evidence Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream UI Browser run progress and screenshot evidence into the Tests page during Run, then keep the same evidence visible in Review.

**Architecture:** Backend registers local screenshots as served workbench artifacts before emitting SSE evidence events or saving the run result. Frontend records Run job SSE events in `useWorkbench`, derives progress/evidence lists, and renders a shared evidence panel in Run and Review.

**Tech Stack:** Fastify, Node `fs/promises`, TypeScript, React, Vite, SSE/EventSource, existing workbench job queue and UI Browser adapter.

---

## File Structure

- Create `backend/src/modules/workbench/artifacts/workbench-artifact-store.ts`
  - Owns in-memory artifact registration and safe path resolution.
  - Copies local screenshot files into `backend/.artifacts/workbench/:sessionId/:jobId/:artifactId.ext`.
  - Returns `Evidence` values with browser-safe API URLs.
- Create `backend/src/modules/workbench/artifacts/workbench-artifact-store.test.ts`
  - Verifies local file registration, copied output, URL shape, unknown artifact behavior, and metadata fallback behavior.
- Modify `backend/src/modules/workbench/workbench.service.ts`
  - Injects artifact store.
  - Normalizes screenshot/artifact events before publishing.
  - Normalizes final `TestRunResult.ui.evidence` before storing result.
- Modify `backend/src/modules/workbench/index.ts`
  - Constructs and passes the artifact store.
- Modify `backend/src/modules/workbench/workbench.routes.ts`
  - Adds `GET /:sessionId/artifacts/:artifactId`.
  - Serves registered artifact files with image content type.
- Modify `backend/src/modules/workbench/adapters/test-type-adapter.ts`
  - Lets adapter `emit` return the normalized event.
- Modify `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.ts`
  - Awaits screenshot event normalization and returns normalized evidence in the run result.
- Modify `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.ts`
  - Extracts actual screenshot file paths from `agent-browser` stdout such as `✓ Screenshot saved to /path/file.png`.
- Modify backend tests:
  - `backend/src/modules/workbench/workbench.routes.test.ts`
  - `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.test.ts`
  - `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.test.ts`
- Create `frontend/src/pages/generate-tests/evidence-panel.tsx`
  - Shared Run/Review evidence display.
- Modify `frontend/src/pages/generate-tests/use-workbench.ts`
  - Stores run events, progress events, and evidence artifacts.
- Modify `frontend/src/pages/GenerateTestsPage.tsx`
  - Passes progress/evidence props into Run and Review steps.
- Modify `frontend/src/pages/generate-tests/steps/run-step.tsx`
  - Renders live progress and screenshot thumbnails.
- Modify `frontend/src/pages/generate-tests/steps/review-step.tsx`
  - Renders persisted evidence from the same run event state.
- Modify `frontend/src/data/generateTestsMockData.ts`
  - Adds mock screenshot hrefs so no-backend mode still shows evidence.

---

### Task 1: Backend Artifact Store

**Files:**
- Create: `backend/src/modules/workbench/artifacts/workbench-artifact-store.ts`
- Create: `backend/src/modules/workbench/artifacts/workbench-artifact-store.test.ts`

- [ ] **Step 1: Write artifact store tests**

Create `backend/src/modules/workbench/artifacts/workbench-artifact-store.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkbenchArtifactStore } from './workbench-artifact-store.js';

test('artifact store copies local screenshot and returns browser URL', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-source-'));
  const source = path.join(sourceDir, 'onboarding.png');
  await writeFile(source, Buffer.from('fake-png'));

  const store = new WorkbenchArtifactStore({ rootDir: root });
  const evidence = await store.registerEvidence({
    sessionId: 'session-1',
    jobId: 'job-1',
    evidence: { kind: 'screenshot', label: 'Onboarding screenshot', href: source },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Onboarding screenshot');
  assert.match(evidence.href ?? '', /^\/api\/workbench\/session-1\/artifacts\/.+\.png$/);

  const artifactId = evidence.href?.split('/').at(-1);
  assert.ok(artifactId);
  const artifact = store.getArtifact('session-1', artifactId);
  assert.ok(artifact);
  assert.equal(artifact.contentType, 'image/png');
  assert.equal(await readFile(artifact.filePath, 'utf8'), 'fake-png');
});

test('artifact store extracts a path from agent-browser screenshot stdout', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-source-'));
  const source = path.join(sourceDir, 'screen.png');
  await writeFile(source, Buffer.from('png'));

  const store = new WorkbenchArtifactStore({ rootDir: root });
  const evidence = await store.registerEvidence({
    sessionId: 'session-2',
    jobId: 'job-2',
    evidence: {
      kind: 'screenshot',
      label: 'Agent browser screenshot',
      href: `✓ Screenshot saved to ${source}`,
    },
  });

  assert.match(evidence.href ?? '', /^\/api\/workbench\/session-2\/artifacts\/.+\.png$/);
});

test('artifact store keeps metadata when local file cannot be copied', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const store = new WorkbenchArtifactStore({ rootDir: root });

  const evidence = await store.registerEvidence({
    sessionId: 'session-3',
    jobId: 'job-3',
    evidence: { kind: 'screenshot', label: 'Missing screenshot', href: '/missing/file.png' },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Missing screenshot');
  assert.equal(evidence.href, undefined);
});

test('artifact store returns undefined for unknown artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const store = new WorkbenchArtifactStore({ rootDir: root });

  assert.equal(store.getArtifact('missing-session', 'missing.png'), undefined);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
rtk pnpm --dir backend test -- workbench-artifact-store.test.ts
```

Expected: fails because `workbench-artifact-store.ts` does not exist.

- [ ] **Step 3: Implement artifact store**

Create `backend/src/modules/workbench/artifacts/workbench-artifact-store.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Evidence } from '../workbench.types.js';

export interface RegisteredArtifact {
  artifactId: string;
  sessionId: string;
  jobId: string;
  filePath: string;
  contentType: string;
}

export interface RegisterEvidenceInput {
  sessionId: string;
  jobId: string;
  evidence: Evidence;
}

export class WorkbenchArtifactStore {
  private readonly rootDir: string;
  private readonly artifacts = new Map<string, RegisteredArtifact>();

  constructor(options: { rootDir?: string } = {}) {
    this.rootDir = options.rootDir ?? path.join(process.cwd(), '.artifacts', 'workbench');
  }

  async registerEvidence(input: RegisterEvidenceInput): Promise<Evidence> {
    if (input.evidence.kind !== 'screenshot') return input.evidence;

    const sourcePath = extractLocalPath(input.evidence.href);
    if (!sourcePath) return { ...input.evidence, href: undefined };

    const ext = extensionFor(sourcePath);
    const artifactId = `${randomUUID()}${ext}`;
    const dir = path.join(this.rootDir, input.sessionId, input.jobId);
    const filePath = path.join(dir, artifactId);

    try {
      await mkdir(dir, { recursive: true });
      await copyFile(sourcePath, filePath);
    } catch {
      return { ...input.evidence, href: undefined };
    }

    const artifact: RegisteredArtifact = {
      artifactId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      filePath,
      contentType: contentTypeFor(ext),
    };
    this.artifacts.set(key(input.sessionId, artifactId), artifact);

    return {
      ...input.evidence,
      href: `/api/workbench/${input.sessionId}/artifacts/${artifactId}`,
    };
  }

  getArtifact(sessionId: string, artifactId: string): RegisteredArtifact | undefined {
    return this.artifacts.get(key(sessionId, artifactId));
  }
}

function key(sessionId: string, artifactId: string): string {
  return `${sessionId}:${artifactId}`;
}

function extractLocalPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const savedMatch = trimmed.match(/Screenshot saved to\s+(.+)$/i);
  const candidate = savedMatch?.[1]?.trim() ?? trimmed;
  if (!path.isAbsolute(candidate)) return undefined;
  return candidate;
}

function extensionFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.jpg' || ext === '.jpeg' || ext === '.webp' ? ext : '.png';
}

function contentTypeFor(ext: string): string {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}
```

- [ ] **Step 4: Run artifact store tests**

Run:

```bash
rtk pnpm --dir backend test -- workbench-artifact-store.test.ts
```

Expected: all artifact store tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add backend/src/modules/workbench/artifacts
rtk git commit -m "feat: add workbench artifact store"
```

---

### Task 2: Backend Artifact Route

**Files:**
- Modify: `backend/src/modules/workbench/index.ts`
- Modify: `backend/src/modules/workbench/workbench.service.ts`
- Modify: `backend/src/modules/workbench/workbench.routes.ts`
- Modify: `backend/src/modules/workbench/workbench.routes.test.ts`

- [ ] **Step 1: Add route test for served artifacts**

Append this test to `backend/src/modules/workbench/workbench.routes.test.ts`:

```ts
test('workbench routes serve registered screenshot artifacts', async () => {
  const app = buildApp();
  const session = await createSession(app);

  const missingRes = await app.inject({
    method: 'GET',
    url: `/api/workbench/${session.id}/artifacts/missing.png`,
  });
  assert.equal(missingRes.statusCode, 404);
});
```

This first test establishes the 404 behavior. A success-path route test is added in Task 3 after run evidence is normalized and registered by the service.

- [ ] **Step 2: Run route tests**

Run:

```bash
rtk pnpm --dir backend test -- workbench.routes.test.ts
```

Expected: fails because the artifact route does not exist.

- [ ] **Step 3: Wire artifact store into service**

Modify `backend/src/modules/workbench/workbench.service.ts` imports and constructor:

```ts
import type { WorkbenchArtifactStore, RegisteredArtifact } from './artifacts/workbench-artifact-store.js';
```

Add a constructor parameter after `eventBus`:

```ts
private readonly artifactStore: WorkbenchArtifactStore,
```

Add this public method:

```ts
getArtifact(sessionId: string, artifactId: string): RegisteredArtifact | undefined {
  this.requireSession(sessionId);
  return this.artifactStore.getArtifact(sessionId, artifactId);
}
```

Modify `backend/src/modules/workbench/index.ts`:

```ts
import { WorkbenchArtifactStore } from './artifacts/workbench-artifact-store.js';
```

Pass the store into `WorkbenchService`:

```ts
const artifactStore = new WorkbenchArtifactStore();

export const workbenchRoutes = buildWorkbenchRoutes(
  new WorkbenchService(
    new WorkbenchJobStore(),
    new WorkbenchJobQueue({ concurrency: 1 }),
    new WorkbenchJobEventBus(),
    artifactStore,
    new LocalRepositoryContextProvider(),
    [new UiBrowserAdapter()],
  ),
);
```

- [ ] **Step 4: Add artifact route**

Modify `backend/src/modules/workbench/workbench.routes.ts`.

Add params:

```ts
interface ArtifactParams extends SessionParams {
  artifactId: string;
}
```

Add imports:

```ts
import { createReadStream } from 'node:fs';
```

Add route before job routes:

```ts
app.get('/:sessionId/artifacts/:artifactId', async (request: FastifyRequest<{ Params: ArtifactParams }>, reply) => {
  try {
    const artifact = service.getArtifact(request.params.sessionId, request.params.artifactId);
    if (!artifact) return reply.code(404).send({ error: 'Workbench artifact not found' });

    reply.header('Content-Type', artifact.contentType);
    reply.header('Cache-Control', 'no-store');
    return reply.send(createReadStream(artifact.filePath));
  } catch (error) {
    return routeError(reply, error);
  }
});
```

- [ ] **Step 5: Run route tests**

Run:

```bash
rtk pnpm --dir backend test -- workbench.routes.test.ts
```

Expected: route tests pass.

- [ ] **Step 6: Run backend typecheck**

Run:

```bash
rtk pnpm --dir backend typecheck
```

Expected: typecheck passes.

- [ ] **Step 7: Commit**

```bash
rtk git add backend/src/modules/workbench/index.ts backend/src/modules/workbench/workbench.service.ts backend/src/modules/workbench/workbench.routes.ts backend/src/modules/workbench/workbench.routes.test.ts
rtk git commit -m "feat: serve workbench evidence artifacts"
```

---

### Task 3: Normalize Screenshot Evidence Before SSE and Result Storage

**Files:**
- Modify: `backend/src/modules/workbench/adapters/test-type-adapter.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.test.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.test.ts`
- Modify: `backend/src/modules/workbench/workbench.service.ts`
- Modify: `backend/src/modules/workbench/workbench.routes.test.ts`

- [ ] **Step 1: Update runner test for stdout path parsing**

In `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.test.ts`, change the screenshot executor branch to return agent-browser-style stdout:

```ts
if (args[0] === 'screenshot') {
  return { exitCode: 0, stdout: '✓ Screenshot saved to /tmp/onboarding.png\n', stderr: '' };
}
```

Assert the runner strips the prefix:

```ts
assert.equal(result.evidence[0]?.href, '/tmp/onboarding.png');
```

- [ ] **Step 2: Run runner test and verify failure**

Run:

```bash
rtk pnpm --dir backend test -- ui-browser-runner.test.ts
```

Expected: fails because the runner currently stores the full stdout string.

- [ ] **Step 3: Parse screenshot path in runner**

Modify `evidenceFromScreenshot` in `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.ts`:

```ts
function evidenceFromScreenshot(stdout: string): Evidence {
  const href = screenshotPathFromStdout(stdout);
  return screenshotEvidence('Onboarding screenshot', href);
}

function screenshotPathFromStdout(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  const savedMatch = trimmed.match(/Screenshot saved to\s+(.+)$/i);
  const value = savedMatch?.[1]?.trim() ?? trimmed;
  return value.length > 0 ? value : undefined;
}
```

- [ ] **Step 4: Run runner test**

Run:

```bash
rtk pnpm --dir backend test -- ui-browser-runner.test.ts
```

Expected: runner tests pass.

- [ ] **Step 5: Change adapter emit contract**

Modify `backend/src/modules/workbench/adapters/test-type-adapter.ts`.

Change:

```ts
emit: (event: AdapterEvent) => void;
```

to:

```ts
emit: (event: AdapterEvent) => Promise<AdapterEvent>;
```

- [ ] **Step 6: Normalize evidence in service emit**

In `backend/src/modules/workbench/workbench.service.ts`, replace the synchronous `emit` helper with:

```ts
private async emit(sessionId: string, jobId: string, event: AdapterEvent): Promise<AdapterEvent> {
  const job = this.requireJob(sessionId, jobId);
  const normalizedEvent = await this.normalizeArtifactEvent(sessionId, jobId, event);
  const normalized = { ...normalizedEvent, jobId, step: job.step } as WorkbenchJobEvent;
  this.store.appendEvent(sessionId, jobId, normalized);
  this.eventBus.publish(eventKey(sessionId, jobId), normalized);
  return normalizedEvent;
}

private async normalizeArtifactEvent(sessionId: string, jobId: string, event: AdapterEvent): Promise<AdapterEvent> {
  if ((event.type === 'screenshot' || event.type === 'artifact') && event.artifact.kind === 'screenshot') {
    const artifact = await this.artifactStore.registerEvidence({ sessionId, jobId, evidence: event.artifact });
    return { ...event, artifact } as AdapterEvent;
  }
  return event;
}
```

Update `baseInput.emit`:

```ts
emit: (event: AdapterEvent) => this.emit(session.id, job.id, event),
```

- [ ] **Step 7: Normalize final run result evidence**

Add this method to `WorkbenchService`:

```ts
private async normalizeStepResult(
  sessionId: string,
  jobId: string,
  step: WorkbenchJobStep,
  result: IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary,
): Promise<IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary> {
  if (step !== 'run') return result;
  const run = result as TestRunResult;
  const evidence = await Promise.all(
    run.ui.evidence.map(item => this.artifactStore.registerEvidence({ sessionId, jobId, evidence: item })),
  );
  return { ...run, ui: { ...run.ui, evidence } };
}
```

In `startJob`, replace:

```ts
const result = await this.runAdapterStep(adapter, step, baseInput, currentSession, approval);
this.setStepResult(session.id, step, result);
this.emit(session.id, job.id, { type: 'result', payload: result });
```

with:

```ts
const rawResult = await this.runAdapterStep(adapter, step, baseInput, currentSession, approval);
const result = await this.normalizeStepResult(session.id, job.id, step, rawResult);
this.setStepResult(session.id, step, result);
await this.emit(session.id, job.id, { type: 'result', payload: result });
```

- [ ] **Step 8: Await screenshot event normalization in UI adapter**

Modify the evidence loop in `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.ts`:

```ts
const evidence: UiBrowserRunnerResult['evidence'] = [];
for (const item of result.evidence) {
  if (item.kind === 'screenshot') {
    const emitted = await input.emit({ type: 'screenshot', artifact: item });
    if (emitted.type === 'screenshot') evidence.push(emitted.artifact);
  } else {
    evidence.push(item);
  }
}
return { ...result, evidence };
```

- [ ] **Step 9: Add deterministic service/route success test for screenshot artifact serving**

Add these imports to `backend/src/modules/workbench/workbench.routes.test.ts`:

```ts
import Fastify from 'fastify';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { UiBrowserAdapter } from './adapters/ui-browser/ui-browser.adapter.js';
import { WorkbenchArtifactStore } from './artifacts/workbench-artifact-store.js';
import { WorkbenchJobEventBus } from './jobs/job-events.js';
import { WorkbenchJobQueue } from './jobs/job-queue.js';
import { WorkbenchJobStore } from './jobs/job-store.js';
import { LocalGuardrailRepositoryProvider } from './repositories/local-guardrail-repository-provider.js';
import { buildWorkbenchRoutes } from './workbench.routes.js';
import { WorkbenchService } from './workbench.service.js';
```

Append this helper to the same file:

```ts
async function buildArtifactRouteTestApp(screenshotPath: string, artifactRoot: string) {
  const app = Fastify();
  const rootDir = path.basename(process.cwd()) === 'backend' ? path.dirname(process.cwd()) : process.cwd();

  const service = new WorkbenchService(
    new WorkbenchJobStore(),
    new WorkbenchJobQueue({ concurrency: 1 }),
    new WorkbenchJobEventBus(),
    new WorkbenchArtifactStore({ rootDir: artifactRoot }),
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
```

Append this test. It uses a temporary screenshot file and the in-process workbench app; it must not depend on a real `agent-browser` process:

```ts
test('workbench run job emits screenshot event with served artifact URL', async () => {
  const screenshotDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-screenshot-'));
  const screenshotPath = path.join(screenshotDir, 'onboarding.png');
  await writeFile(screenshotPath, Buffer.from('fake-png'));

  const artifactRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const app = await buildArtifactRouteTestApp(screenshotPath, artifactRoot);
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
  assert.match(screenshot.type === 'screenshot' ? screenshot.artifact.href ?? '' : '', new RegExp(`^/api/workbench/${session.id}/artifacts/.+\\\\.png$`));

  const artifactUrl = screenshot.type === 'screenshot' ? screenshot.artifact.href ?? '' : '';
  const artifactRes = await app.inject({ method: 'GET', url: artifactUrl });
  assert.equal(artifactRes.statusCode, 200);
  assert.match(String(artifactRes.headers['content-type']), /^image\//);
});
```

- [ ] **Step 10: Run backend tests and typecheck**

Run:

```bash
rtk pnpm --dir backend test
rtk pnpm --dir backend typecheck
```

Expected: all backend tests and typecheck pass.

- [ ] **Step 11: Commit**

```bash
rtk git add backend/src/modules/workbench
rtk git commit -m "feat: stream served screenshot evidence"
```

---

### Task 4: Frontend Run Event State

**Files:**
- Modify: `frontend/src/pages/generate-tests/use-workbench.ts`
- Modify: `frontend/src/data/generateTestsMockData.ts`

- [ ] **Step 1: Add run event state types to hook**

Modify `frontend/src/pages/generate-tests/use-workbench.ts`.

Update imports:

```ts
import type { WorkbenchSession, IntentInput, Evidence } from '@/types/testlens';
import type { JobEvent } from '@/data/workbench-api';
```

Add exported types:

```ts
export type RunProgressEvent = Extract<JobEvent, { type: 'progress' | 'thinking' | 'error' | 'status' }>;

export interface UseWorkbenchResult {
  // existing fields...
  runEvents: JobEvent[];
  runProgress: RunProgressEvent[];
  runEvidence: Evidence[];
}
```

- [ ] **Step 2: Store and derive run events**

Add state:

```ts
const [runEvents, setRunEvents] = React.useState<JobEvent[]>([]);
```

Add derived state before `return`:

```ts
const runProgress = React.useMemo(
  () => runEvents.filter((event): event is RunProgressEvent =>
    event.type === 'progress' || event.type === 'thinking' || event.type === 'error' || event.type === 'status',
  ),
  [runEvents],
);

const runEvidence = React.useMemo(
  () => runEvents.flatMap(event => {
    if (event.type === 'screenshot' || event.type === 'artifact') return [event.artifact];
    return [];
  }),
  [runEvents],
);
```

Update `runTests()`:

```ts
setRunEvents([]);

runSession(session.id, event => {
  setRunEvents(events => [...events, event]);
})
```

Add `runEvents`, `runProgress`, and `runEvidence` to the returned object.

- [ ] **Step 3: Add mock evidence href**

In `frontend/src/data/generateTestsMockData.ts`, update `mockWorkbench.run.ui.evidence` to include an image URL that works in local mock mode:

```ts
evidence: [{ kind: 'screenshot', label: 'timeout message visible', href: 'https://placehold.co/960x540/111827/818cf8?text=UI+Browser+Evidence' }],
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
rtk pnpm --dir frontend typecheck
```

Expected: typecheck passes.

- [ ] **Step 5: Commit**

```bash
rtk git add frontend/src/pages/generate-tests/use-workbench.ts frontend/src/data/generateTestsMockData.ts
rtk git commit -m "feat: retain workbench run events"
```

---

### Task 5: Evidence Panel Component

**Files:**
- Create: `frontend/src/pages/generate-tests/evidence-panel.tsx`
- Modify: `frontend/src/pages/generate-tests/steps/run-step.tsx`
- Modify: `frontend/src/pages/generate-tests/steps/review-step.tsx`
- Modify: `frontend/src/pages/GenerateTestsPage.tsx`

- [ ] **Step 1: Create reusable evidence panel**

Create `frontend/src/pages/generate-tests/evidence-panel.tsx`:

```tsx
import type { Evidence } from '@/types/testlens';
import type { RunProgressEvent } from './use-workbench';
import { BlockHeader } from './shared';
import { EyeIcon, LoaderIcon, WarningTriangleIcon } from '@/components/icons';

interface EvidencePanelProps {
  title?: string;
  running?: boolean;
  progress: RunProgressEvent[];
  evidence: Evidence[];
}

export function EvidencePanel({ title = 'Evidence', running = false, progress, evidence }: EvidencePanelProps) {
  const latestScreenshot = [...evidence].reverse().find(item => item.kind === 'screenshot');

  return (
    <div className="mb-[18px]">
      <BlockHeader label={title} count={evidence.length} />
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-[14px] items-start">
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] min-h-[180px]">
          <div className="flex items-center gap-[8px] text-[12px] font-semibold text-[#98a1b3] uppercase tracking-[0.5px] mb-[10px]">
            {running && <LoaderIcon className="w-[13px] h-[13px] animate-spin text-[#818cf8]" />}
            Progress stream
          </div>
          <div className="flex flex-col gap-[8px]">
            {progress.length === 0 && (
              <div className="text-[12.5px] text-[#6b7488]">Waiting for run progress...</div>
            )}
            {progress.slice(-8).map((event, index) => (
              <div key={`${event.type}-${index}-${'message' in event ? event.message : event.status}`} className="text-[12.5px] text-[#98a1b3] leading-[1.45] flex gap-[8px]">
                <span className="text-[#818cf8] font-mono text-[11px] mt-[1px]">{event.type}</span>
                <span>{'message' in event ? event.message : event.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] min-h-[180px]">
          <div className="text-[12px] font-semibold text-[#98a1b3] uppercase tracking-[0.5px] mb-[10px]">Latest screenshot</div>
          {latestScreenshot?.href ? (
            <a href={latestScreenshot.href} target="_blank" rel="noreferrer" className="block group">
              <img src={latestScreenshot.href} alt={latestScreenshot.label} className="w-full aspect-video object-cover rounded-[8px] border border-[rgba(255,255,255,0.09)] bg-[#0d0f16]" />
              <div className="flex items-center gap-[6px] text-[11.5px] text-[#818cf8] mt-[8px] group-hover:underline">
                <EyeIcon className="w-[12px] h-[12px]" />
                {latestScreenshot.label}
              </div>
            </a>
          ) : evidence.length > 0 ? (
            <div className="text-[12.5px] text-[#fbbf24] flex gap-[8px] leading-[1.45]">
              <WarningTriangleIcon className="w-[15px] h-[15px] flex-shrink-0 mt-[2px]" />
              Evidence was captured, but no displayable screenshot URL is available.
            </div>
          ) : (
            <div className="text-[12.5px] text-[#6b7488]">No screenshot captured yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pass props through page**

Modify `frontend/src/pages/GenerateTestsPage.tsx`.

For `RunStep`, add:

```tsx
progress={wb.runProgress}
evidence={wb.runEvidence}
```

For `ReviewStep`, add:

```tsx
progress={wb.runProgress}
evidence={wb.runEvidence}
```

- [ ] **Step 3: Render evidence panel in RunStep**

Modify imports in `frontend/src/pages/generate-tests/steps/run-step.tsx`:

```ts
import type { Evidence } from '@/types/testlens';
import type { RunProgressEvent } from '../use-workbench';
import { EvidencePanel } from '../evidence-panel';
```

Extend props:

```ts
progress: RunProgressEvent[];
evidence: Evidence[];
```

Update function signature:

```tsx
export function RunStep({ run, ranTests, running, progress, evidence, onBack, onReview, onAttentionAction }: RunStepProps) {
```

In the `!run` branch, place this below the running text and above Back:

```tsx
<EvidencePanel running progress={progress} evidence={evidence} />
```

In the normal render, place this below the main progress bar and above suite headers:

```tsx
<EvidencePanel running={running} progress={progress} evidence={evidence.length ? evidence : run.ui.evidence} />
```

- [ ] **Step 4: Render evidence panel in ReviewStep**

Modify imports in `frontend/src/pages/generate-tests/steps/review-step.tsx`:

```ts
import type { ReviewSummary, RiskRow, GeneratedChange, DiffLine, Evidence } from '@/types/testlens';
import type { RunProgressEvent } from '../use-workbench';
import { EvidencePanel } from '../evidence-panel';
```

Extend props:

```ts
progress: RunProgressEvent[];
evidence: Evidence[];
```

Update function signature:

```tsx
export function ReviewStep({ review, changes, applied, progress, evidence, onBack, onApply, onCreatePR, onExport }: ReviewStepProps) {
```

Place this after the recommendation banner:

```tsx
<EvidencePanel title="Evidence from run" progress={progress} evidence={evidence} />
```

- [ ] **Step 5: Run frontend typecheck**

Run:

```bash
rtk pnpm --dir frontend typecheck
```

Expected: typecheck passes.

- [ ] **Step 6: Commit**

```bash
rtk git add frontend/src/pages/GenerateTestsPage.tsx frontend/src/pages/generate-tests/evidence-panel.tsx frontend/src/pages/generate-tests/steps/run-step.tsx frontend/src/pages/generate-tests/steps/review-step.tsx
rtk git commit -m "feat: show workbench run evidence"
```

---

### Task 6: End-to-End Verification

**Files:**
- No source files unless verification finds a defect.

- [ ] **Step 1: Run full backend tests**

Run:

```bash
rtk pnpm --dir backend test
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
rtk pnpm --dir frontend typecheck
```

Expected: typecheck passes.

- [ ] **Step 3: Start or reuse local backend**

Check backend health:

```bash
rtk curl -sS -i http://127.0.0.1:3000/health/
```

Expected: `HTTP/1.1 200 OK`.

If no backend is running, start the backend dev server:

```bash
rtk pnpm --dir backend dev
```

- [ ] **Step 4: Start frontend with API base**

Run:

```bash
rtk env VITE_API_BASE_URL=http://127.0.0.1:3000 pnpm --dir frontend dev --host 127.0.0.1 --port 5175
```

Expected: Vite reports a local URL at `http://127.0.0.1:5175/`.

- [ ] **Step 5: Manual smoke in browser**

Open:

```text
http://127.0.0.1:5175/tests
```

Use intent:

```text
Add UI Browser tests for onboarding repository selection
```

Expected:

- Intent advances to Isolation.
- Plan advances to Generate.
- Generate shows the UI Browser onboarding feature.
- Run shows progress messages during execution.
- Run shows a screenshot thumbnail before or by the time the run completes.
- Review shows the same screenshot in “Evidence from run”.

- [ ] **Step 6: Verify artifact URL directly**

Open the screenshot `href` from the Run or Review evidence thumbnail.

Expected:

- URL path starts with `/api/workbench/`.
- Response displays the screenshot image.
- URL does not expose a local filesystem path.

- [ ] **Step 7: Commit verification fixes if needed**

If verification required source changes, run the relevant tests again and commit:

```bash
rtk git status --short
rtk git add backend/src/modules/workbench frontend/src/pages/GenerateTestsPage.tsx frontend/src/pages/generate-tests frontend/src/data/generateTestsMockData.ts
rtk git commit -m "fix: complete workbench evidence streaming"
```

If verification required no source changes, do not create a commit.

---

## Self-Review Notes

- Spec coverage: backend artifact serving is covered by Tasks 1-3; frontend event state and Run/Review rendering are covered by Tasks 4-5; smoke verification is covered by Task 6.
- Placeholder scan: this plan does not use placeholder implementation steps. The only conditional step is Task 6 Step 7, which is a verification checkpoint with explicit behavior.
- Type consistency: `Evidence`, `JobEvent`, `RunProgressEvent`, `runProgress`, and `runEvidence` are defined before use and passed consistently through `GenerateTestsPage`, `RunStep`, and `ReviewStep`.
