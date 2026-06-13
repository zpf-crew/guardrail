# UI Browser Workbench Backend Design

**Date:** 2026-06-12
**Topic:** Adapter-based backend slice for UI Browser tests in the Generate / Improve workbench
**Status:** Approved design

## 1. Goal

Implement an isolated backend vertical slice for the Tests page UI Browser workflow.

The frontend already models the Generate / Improve workbench as six steps:

1. Intent
2. Isolation
3. Plan
4. Generate
5. Run
6. Review

This backend slice must preserve that flow. It should replace the current mock seam with a real orchestration path for UI Browser tests, while keeping repository integration, persistence, and other test-type adapters out of scope for this first implementation.

The first runnable scenario targets the existing Guardrail onboarding page because it has real client-side behavior while remaining stable and self-contained.

## 2. Scope

### In Scope

- Create an in-memory workbench session for the local Guardrail repo.
- Add async job-based execution for the long workbench steps.
- Stream job progress to the frontend with SSE.
- Add a shared test-type adapter interface.
- Implement the first adapter: `UI / Browser`.
- Generate human-readable UI Browser test cases in a Gherkin-like format.
- Run the generated onboarding scenario with `agent-browser`.
- Capture logs, screenshots, and evidence for the Run and Review steps.
- Use deterministic fallback payloads when LLM configuration is unavailable or an LLM request fails.

### Out of Scope

- Real GitHub repository selection.
- Persistent sessions, jobs, test cases, or evidence.
- Applying generated artifacts to the working tree.
- Creating pull requests.
- Full Unit, Integration, E2E, Mobile, Contract, Security, or Visual Screenshot adapters.
- Full coverage/test-run integration for repo-native test commands.

## 3. Architecture

The backend should implement the existing workbench contract rather than introduce a new frontend flow.

The core pieces are:

- `RepositoryContextProvider`: loads selected repository context. In v1 this is a local mock provider for the Guardrail repo.
- `WorkbenchService`: owns session lifecycle, step ordering, adapter selection, and job creation.
- `WorkbenchJobQueue`: runs long steps asynchronously with timeouts.
- `WorkbenchJobStore`: stores in-memory session, job, result, and event state.
- `WorkbenchJobEvents`: appends job events and fans them out over SSE.
- `TestTypeAdapter`: common interface for test-type-specific logic.
- `UiBrowserAdapter`: first adapter implementation for UI Browser tests.
- `UiBrowserRunner`: executes generated scenarios with `agent-browser`.
- `UiBrowserEvidence`: maps screenshots, logs, and traces into frontend `Evidence[]`.

The orchestrator understands the six Guardrail workbench steps. It does not understand how UI Browser tests are generated or run. That behavior stays inside the UI Browser adapter.

## 4. Proposed Module Layout

```text
backend/src/modules/workbench/
  workbench.routes.ts
  workbench.service.ts
  workbench.types.ts

  jobs/
    job-queue.ts
    job-store.ts
    job-events.ts
    job-timeouts.ts

  repositories/
    repository-context-provider.ts
    local-guardrail-repository-provider.ts

  adapters/
    test-type-adapter.ts
    ui-browser/
      ui-browser.adapter.ts
      ui-browser.prompts.ts
      ui-browser-runner.ts
      ui-browser-evidence.ts
```

## 5. API Design

Session creation can remain synchronous because it does not call an LLM or run browser automation.

```text
POST /api/workbench/sessions
```

Long-running steps should start jobs and return immediately:

```text
POST /api/workbench/:sessionId/analyze/jobs
POST /api/workbench/:sessionId/plan/jobs
POST /api/workbench/:sessionId/generate/jobs
POST /api/workbench/:sessionId/run/jobs
POST /api/workbench/:sessionId/review/jobs
```

Job observation:

```text
GET /api/workbench/:sessionId/jobs/:jobId
GET /api/workbench/:sessionId/jobs/:jobId/events
```

The first endpoint returns a snapshot for polling fallback. The second endpoint streams server-sent events.

SSE is preferred over WebSocket for this slice because the needed traffic is backend-to-frontend progress, logs, artifacts, screenshots, and final result payloads. WebSocket can be introduced later if the product needs bidirectional controls such as pause, resume, or manual intervention during execution.

## 6. Job Event Contract

Each job should emit an append-only event stream. Events should be safe to show in the UI and safe to replay from the in-memory event buffer.

```ts
type WorkbenchJobEvent =
  | {
      type: 'status';
      jobId: string;
      step: WorkflowStepId;
      status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout';
    }
  | {
      type: 'progress';
      jobId: string;
      step: WorkflowStepId;
      percent?: number;
      message: string;
    }
  | {
      type: 'thinking';
      jobId: string;
      step: WorkflowStepId;
      message: string;
    }
  | {
      type: 'artifact';
      jobId: string;
      step: WorkflowStepId;
      artifact: Evidence;
    }
  | {
      type: 'screenshot';
      jobId: string;
      step: 'run';
      artifact: Evidence;
    }
  | {
      type: 'result';
      jobId: string;
      step: WorkflowStepId;
      payload: IsolationResult | TestPlan | GenerationResult | TestRunResult | ReviewSummary;
    }
  | {
      type: 'error';
      jobId: string;
      step: WorkflowStepId;
      message: string;
      retryable: boolean;
    };
```

`thinking` events are short progress summaries, not raw chain-of-thought.

## 7. Step Data Flow

### Step 1: Intent

Frontend sends the intent and active repo id. The backend creates an in-memory `WorkbenchSession`.

In v1, the selected repo is always the local Guardrail repo. The repo context includes:

- repo name, branch, path, and current commit when available
- frontend start command
- onboarding route
- relevant source files
- mocked docs and QC cases
- route and interaction hints for the onboarding flow

### Step 2: Isolation

`WorkbenchService` starts an analyze job. The job loads repository context and calls `UiBrowserAdapter.analyze()`.

The adapter returns `IsolationResult` with:

- related source files
- existing test files, if any
- mocked spec docs
- mocked QC cases
- deterministic coverage and status values clearly marked as mock-derived
- detected onboarding user journeys
- behavior classifications focused on UI Browser coverage

### Step 3: Plan

The plan job calls `UiBrowserAdapter.plan()` and returns `TestPlan`.

The plan should make clear:

- UI Browser tests will be generated.
- Browser automation is required.
- Production code changes are not expected.
- The generated artifact is a staged human-readable test case, not an applied file.
- Any unsupported selected test types are ignored with a clear warning or represented as future adapter work.

### Step 4: Generate

The generate job runs after plan approval. It calls `UiBrowserAdapter.generate()`.

The result is a `GenerationResult` containing:

- a timeline of generation steps
- one or more `GeneratedChange` entries
- a before/after summary

For UI Browser tests, a `GeneratedChange` can represent a proposed file such as:

```text
guardrail-tests/ui/onboarding.feature
```

The diff should contain a human-readable test case, likely Gherkin-style:

```gherkin
Feature: Guardrail onboarding
  Scenario: Complete repository onboarding with optional docs and QC cases
    Given the user opens the Guardrail onboarding page
    When the user selects the local Guardrail repository
    And the user continues through product knowledge and QC case steps
    Then the initial scan summary is visible
    And screenshots are captured as evidence
```

This proposed artifact is not applied to disk in v1.

### Step 5: Run

The run job calls `UiBrowserAdapter.run()`, which delegates to `UiBrowserRunner`.

The runner should:

- ensure the Guardrail frontend is reachable or start it through the configured command
- invoke `agent-browser`
- navigate to the onboarding route
- execute the generated scenario steps
- stream progress messages
- capture screenshots and logs
- return `TestRunResult`

The run result should populate the existing UI fields:

- `ui.command`
- `ui.browser`
- `ui.outcome`
- `ui.passed`
- `ui.durationMs`
- `ui.evidence`
- `matrix`
- optional `attention` failure card

Until Unit and Mobile adapters exist, their result sections should use deterministic neutral values with `Skipped` outcomes and text that makes clear those suites were not executed by this UI Browser slice.

### Step 6: Review

The review job builds `ReviewSummary` from the generated cases and run result.

The summary should include:

- tests added/updated/deleted counts
- tests passing summary
- files changed as proposed artifacts
- remaining risks
- open questions
- recommendation
- evidence references captured during the run

No files are applied and no PR is created in v1.

## 8. Adapter Interface

The adapter interface should map directly to the workbench steps:

```ts
interface TestTypeAdapter {
  readonly testType: TestType;

  analyze(input: AdapterInput): Promise<IsolationResult>;
  plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan>;
  generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult>;
  run(input: AdapterInput & { generation: GenerationResult }): Promise<TestRunResult>;
  review(input: AdapterInput & {
    generation: GenerationResult;
    run: TestRunResult;
  }): Promise<ReviewSummary>;
}
```

`AdapterInput` should include:

- session
- repository context
- event emitter
- model clients
- abort signal

The event emitter lets adapters stream progress without knowing about Fastify or SSE.

## 9. Timeout Policy

Step jobs should have explicit timeouts:

| Step | Timeout |
| --- | --- |
| Analyze | 60-90 seconds |
| Plan | 60-90 seconds |
| Generate | 120 seconds |
| Run UI Browser | 180-300 seconds |
| Review | 60 seconds |

On timeout:

- emit a `timeout` status event
- emit an `error` event with `retryable: true`
- preserve partial progress and evidence
- keep the user on the current step
- allow retry

## 10. Failure Handling

- If LLM configuration is missing, use deterministic UI Browser fallback payloads and emit a warning progress event.
- If an LLM request fails, use deterministic fallback output for that step and emit a warning progress event.
- If the frontend app cannot start or cannot be reached, mark the run job failed with an actionable message.
- If `agent-browser` fails, return a failed `TestRunResult` with any captured logs and screenshots.
- If evidence capture fails but the browser scenario passed, mark evidence as incomplete in review risk.
- No failure path applies files to the repo.

## 11. Evidence Model

Evidence should map to the existing frontend `Evidence` type:

```ts
interface Evidence {
  kind: 'screenshot' | 'video' | 'trace' | 'device-log' | 'visual-diff';
  label: string;
  href?: string;
}
```

For v1, evidence should include at least:

- screenshot after opening onboarding
- screenshot after repository selection
- screenshot after advancing optional docs/QC steps
- final screenshot or failure screenshot
- text log artifact when available

Artifact paths may be local backend paths or served URLs. A later persistence layer can move these to durable storage.

## 12. Testing Strategy

Test coverage should focus on deterministic backend behavior first:

- Unit-test adapter selection.
- Unit-test workbench step ordering.
- Unit-test job queue status transitions.
- Unit-test timeout behavior.
- Unit-test SSE event buffering and replay.
- Unit-test UI Browser adapter fallback payloads.
- Integration-test Fastify routes with injected requests.
- Keep real `agent-browser` execution as a manual or smoke test initially because it depends on local frontend/browser availability.

## 13. Open Implementation Notes

- The frontend `useWorkbench` currently calls synchronous `analyze`, `plan`, and `run` functions. Implementation should update the frontend seam to start jobs and consume SSE while preserving the same step components.
- The current type contract comments already mention `/approve`, `/run`, and `/review`. Backend should implement these as job-starting endpoints instead of blocking endpoints.
- The first UI Browser scenario should target onboarding, not the Tests page itself.
- The job queue can be in-process for the hackathon, with concurrency limited to avoid overlapping browser runs.
