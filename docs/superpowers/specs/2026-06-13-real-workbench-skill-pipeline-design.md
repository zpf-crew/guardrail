# Real Workbench Skill Pipeline Design

**Date:** 2026-06-13
**Topic:** Replace hardcoded UI Browser workbench behavior with a repository-grounded, markdown-skill pipeline
**Status:** Approved design

## 1. Problem

The current UI Browser backend slice proves the queue, SSE, artifact serving, and frontend evidence wiring, but the adapter still returns fixed onboarding-oriented payloads. That is not product behavior. Guardrail must treat the selected repository as the source of truth, run the same six workbench steps, and produce results from repository context, model reasoning, generated test artifacts, and real browser execution.

For the hackathon, the selected repository can resolve to the local Guardrail checkout. That is a connector simplification, not a pipeline shortcut. The backend should still scan real files, find relevant source and tests, ask models for structured step outputs, generate real staged UI Browser scenarios, and run them with `agent-browser`.

## 2. Goal

Build a real workbench pipeline for the existing steps:

1. Intent
2. Isolation
3. Plan
4. Generate
5. Run
6. Review

Each long-running step stays job-based and streams progress over SSE. Each step uses product-owned markdown instruction files under `guardrail-skills/`, while TypeScript owns loading, context assembly, schema validation, queueing, and tool execution.

## 3. Product Principles

- Mock missing integrations, not product truth.
- The selected repository is the input. For now that selected repo is the local Guardrail repo.
- The UI Browser adapter must not decide outcomes with hardcoded behavior names.
- Step outputs must be structured and validated against the shared workbench schemas.
- Browser evidence must come from a real `agent-browser` run.
- If the model or runner cannot produce a trustworthy result, the job should fail or return a clear warning state. It must not fake success.

## 4. Scope

### In Scope

- Add markdown skill contracts in `guardrail-skills/`.
- Add a repository scanner for the selected repo, initially local Guardrail.
- Load bounded source, test, spec, and QC context from the repo.
- Run thinker/coder model calls with skill instructions and structured JSON output requirements.
- Validate model output into existing backend workbench schema types.
- Replace deterministic UI Browser adapter content with real pipeline step outputs.
- Generate staged UI Browser test artifacts from the plan.
- Run generated UI Browser scenarios through `agent-browser`.
- Stream progress and screenshots during Run.
- Keep existing in-memory sessions, jobs, SSE events, and artifact serving.

### Out of Scope

- GitHub repository installation and selection.
- Durable database persistence.
- Applying generated test files to the working tree.
- Pull request creation.
- Full adapters for non-UI Browser test types.
- A general natural-language-to-browser-action engine beyond the onboarding hackathon slice.

## 5. Architecture

```text
frontend Tests page
  |
  | POST step job / GET SSE
  v
WorkbenchService
  |
  +-- WorkbenchJobQueue / WorkbenchJobStore / WorkbenchJobEventBus
  |
  +-- RepositoryContextProvider
  |     |
  |     +-- LocalGuardrailRepositoryProvider
  |     +-- RepositoryScanner
  |
  +-- TestTypeAdapterRegistry
        |
        +-- UiBrowserAdapter
              |
              +-- SkillContractLoader
              +-- StructuredModelRunner
              +-- UiBrowserScenarioRunner
              +-- WorkbenchArtifactStore
```

The orchestrator remains generic. It loads the session and repository context, selects the adapter by requested test type, and runs the requested workflow step as an async job.

The adapter is responsible for test-type behavior, but it delegates step reasoning to markdown skills. The adapter should not own hardcoded classifications, plans, generated test cases, or pass/fail results.

## 6. Markdown Skill Contracts

Skill files live at the repository root:

```text
guardrail-skills/
  test-isolation-files.md
  test-plan.md
  test-generate-ui-browser.md
  test-run-ui-browser.md
  test-review.md
```

Each skill file contains:

- Purpose
- Inputs the backend will provide
- Required output shape
- Guardrail product rules
- Uncertainty handling
- Examples only when they clarify format, not fixed product answers

The backend treats these files as versioned product instructions. Product and test authors can edit them without changing TypeScript. TypeScript still enforces runtime contracts.

## 7. Step Data Flow

### Intent

The frontend creates or updates a `WorkbenchSession` with:

- prompt
- feature hint, if selected
- requested test types
- selected source contexts
- selected repository reference

For the hackathon, the selected repository reference resolves to local Guardrail. Later, repository integration can replace that provider without changing the step contracts.

### Isolation

Backend responsibilities:

- Scan repository files.
- Rank relevant source, test, spec, and QC candidates using the intent.
- Read bounded snippets from the highest-signal files.
- Load `guardrail-skills/test-isolation-files.md`.
- Call thinker model with skill instructions and repo context.
- Parse and validate an `IsolationResult`.

Expected behavior:

- For prompt `improve onboarding UI test`, isolation should identify the actual onboarding page, onboarding data, related workbench files when relevant, and existing tests if present.
- Classifications must be derived from repo context and model reasoning.
- If context is insufficient, output should say what is unknown instead of inventing coverage.

### Plan

Backend responsibilities:

- Load `guardrail-skills/test-plan.md`.
- Pass intent and validated isolation result.
- Call thinker model.
- Validate a `TestPlan`.

Expected behavior:

- Plan actions should correspond to isolated gaps.
- UI Browser plans should mark browser automation required.
- Production code changes should be `none` unless the model can justify why production code must change, and this should remain review-blocking.
- Files to change are staged test artifact paths, not automatic writes.

### Generate

Backend responsibilities:

- For `UI / Browser`, load `guardrail-skills/test-generate-ui-browser.md`.
- Pass intent, isolation, plan, source snippets, and approval answers.
- Call coder model.
- Validate a `GenerationResult`.

Expected behavior:

- Generate one or more staged UI Browser scenarios from the plan.
- Scenario content should be human-readable, likely Gherkin-style.
- Generated changes should be reviewable and should not be written to disk in this slice.
- A generation result with zero changes is valid only for cancel/skip decisions or a clear failure state.

### Run

Backend responsibilities:

- Load `guardrail-skills/test-run-ui-browser.md`.
- Convert generated UI Browser scenario steps into a bounded run plan.
- Execute the run plan with `agent-browser`.
- Emit progress for each command/checkpoint.
- Capture screenshots at meaningful checkpoints.
- Register screenshots with `WorkbenchArtifactStore`.
- Validate a `TestRunResult`.

Expected behavior:

- Run must execute the generated scenario, not a fixed script.
- For onboarding, the runner should navigate to the real local frontend route and interact with visible UI controls.
- Evidence should include screenshots streamed during execution.
- If a step cannot be mapped to a safe browser action, the run should fail with captured progress and a clear `attention` card.

### Review

Backend responsibilities:

- Load `guardrail-skills/test-review.md`.
- Pass generation result, run result, and evidence.
- Call thinker model or deterministic summarizer if the run already has enough structured information.
- Validate a `ReviewSummary`.

Expected behavior:

- Review should summarize actual generated artifacts and actual run evidence.
- Remaining risk should mention missing persistence or unresolved run failures.
- Recommendation should be based on pass/fail evidence, not assumed success.

## 8. Repository Scanner

The scanner should work against the selected repository path and return bounded context:

- repo metadata: name, branch, commit, root path
- frontend metadata: route hints and local URL
- related source files
- existing test files
- spec or documentation files
- QC/manual case files or seeded QC inputs
- source snippets with line ranges and file paths

Initial ranking can be pragmatic:

- Use the intent terms, selected feature hint, and requested test type.
- Prefer route/page files matching feature terms, such as `OnboardingPage`.
- Include nearby data files and tests.
- Limit snippets by file count and character budget.

This scanner replaces static `relatedFiles` arrays as the normal path. Seeded QC cases are acceptable for the hackathon only when no QC integration exists, and they must be labeled as seeded input in context.

## 9. Structured Model Runner

The backend needs a small model utility for step calls:

- Load markdown skill text.
- Compose system/user messages from skill text and JSON context.
- Use thinker for isolation, plan, and review.
- Use coder for test generation.
- Require JSON output for schema-backed steps.
- Strip markdown fences if needed.
- Parse JSON.
- Validate with runtime validators for existing workbench schemas.
- Emit short `thinking` summaries that are safe for UI display.

The runner should support bounded fallback behavior:

- If no model is configured, return a failed job with a clear configuration error for real pipeline steps.
- Tests can inject fake model clients.
- Do not replace missing model output with fixed product results in normal runtime.

## 10. UI Browser Scenario Runner

The runner should consume generated scenario content and a run skill. It should produce a run plan made from safe actions:

- open route
- wait for load or selector
- inspect accessibility snapshot
- click visible control by role/name
- fill visible input by label/name
- capture screenshot checkpoint
- assert visible text or state
- close browser session

For the hackathon onboarding slice, a narrow mapper is acceptable if it is based on generated scenario steps and current page state. It can support common onboarding phrases such as opening Guardrail onboarding, selecting a local repository, continuing, and verifying scan/progress visibility.

The runner should capture more than one screenshot when the flow has multiple checkpoints. Screenshots should stream during Run and remain visible in Review.

## 11. API And Events

The existing endpoints remain:

```text
POST /api/workbench/sessions
PATCH /api/workbench/:sessionId/intent
POST /api/workbench/:sessionId/analyze/jobs
POST /api/workbench/:sessionId/plan/jobs
POST /api/workbench/:sessionId/generate/jobs
POST /api/workbench/:sessionId/run/jobs
POST /api/workbench/:sessionId/review/jobs
GET /api/workbench/:sessionId/jobs/:jobId
GET /api/workbench/:sessionId/jobs/:jobId/events
GET /api/workbench/:sessionId/artifacts/:artifactId
```

The existing event contract remains:

- `status`
- `progress`
- `thinking`
- `artifact`
- `screenshot`
- `result`
- `error`

No frontend workflow rewrite is required. The frontend should benefit from better backend results and richer streamed screenshots.

## 12. Error Handling

- Missing skill file: fail the job with a non-retryable configuration error.
- Invalid model JSON: fail the job with a retryable model-output error and include a short parse reason.
- Schema validation failure: fail the job with field-level details safe for developers.
- Repository scan failure: fail isolation before calling the model.
- Agent-browser command failure: return failed `TestRunResult` with progress and any screenshots already captured.
- Artifact registration failure: keep the run result but emit a progress warning and metadata-only evidence if possible.

## 13. Testing

Backend unit tests:

- Skill loader reads expected markdown files and errors on missing files.
- Repository scanner finds onboarding source files from the real repo fixture.
- Structured model runner parses valid JSON and rejects invalid/schema-mismatched output.
- UI Browser adapter isolation uses model output rather than fixed classifications.
- Plan and generate steps consume prior step results.
- Runner maps generated onboarding scenario steps to browser commands.
- Screenshot events are emitted for each captured checkpoint.

Backend route tests:

- Existing job lifecycle tests continue passing.
- A fake model client can drive isolation, plan, generate, run, and review end-to-end.
- Job failure is visible through snapshot and SSE events.

Manual smoke:

- Start backend and frontend.
- Prompt: `improve onboarding UI test`.
- Select `UI / Browser`.
- Run all six steps.
- Confirm isolation names real Guardrail onboarding files.
- Confirm generate output is scenario text derived from plan.
- Confirm run streams browser progress and multiple screenshots.
- Confirm review shows the same evidence and does not claim unsupported coverage.

## 14. Migration Notes

Existing queue, job store, route, and artifact serving code should stay. The main replacement is inside repository context collection and the UI Browser adapter internals.

The previous deterministic fallback payloads should be removed from the normal runtime path. Test fixtures can still use static data, but production code should not return hardcoded onboarding classifications, plans, generated changes, or run success.

## 15. Future Work

- Replace local Guardrail repo provider with real selected repository integration.
- Persist sessions, generated artifacts, and evidence.
- Add adapters for Unit, E2E, Integration, Contract, Mobile, Visual Screenshot, and Security tests using the same markdown skill pattern.
- Add a richer scenario-to-browser planner.
- Add trace/video evidence viewers.
- Add approval workflow for applying generated test files to disk or PRs.
