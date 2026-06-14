# Agentic UI Browser Run Design

**Date:** 2026-06-12
**Topic:** Replace deterministic `UiBrowserRunPlan` execution with a Gherkin-driven, snapshot-ref agent loop
**Status:** Approved design

## 1. Problem

Guardrail UI Browser tests generate human-readable Gherkin scenarios, but the Run step converts them into a fixed JSON action plan (`UiBrowserRunPlan`) before any browser interaction. The coder model guesses selectors and visible text from source snippets without seeing the live page. `UiBrowserRunner` then executes the plan blindly via `agent-browser find role/text ...`.

This causes false failures: screenshots show the correct page, but assertions fail because strings like `Browse Electronics` or `Shop by Category` do not match the DOM accessibility tree. The tests behave like brittle E2E automation, not like a user verifying behavior.

## 2. Goal

Make Guardrail UI Browser **Run** behave like a user testing the app:

1. Keep approved **Gherkin** scenarios as the human-reviewable test contract (Generate step unchanged).
2. At Run time, drive an **agent loop**: snapshot the page, decide the next action from what is visible, act via `@eN` refs, repeat.
3. Evaluate each **`Then`** step explicitly with satisfied/failed + reason + evidence (Option C verdict model).
4. Allow **per-behavior run budgets** proposed in Plan (default 60s per Gherkin step / 15 agent actions; overrides e.g. 120s per step for heavy flows).

## 3. Product Principles

- Gherkin tells **what** to verify; the agent decides **how** on the live page.
- No fake passes — failed `Then` clauses fail the scenario with a clear reason.
- Evidence-first — screenshots and progress stream remain visible during Run.
- Bounded agent loops — step count and time limits prevent runaway cost.
- Mock missing integrations, not product truth — still use real `agent-browser` in normal runtime.

## 4. Decisions Summary

| Topic | Choice |
|-------|--------|
| Test contract | Keep approved Gherkin scenarios from Generate |
| Pass/fail | Each `Then` gets `satisfied` + `reason`; scenario passes only if all `Then`s pass |
| Page interaction | Snapshot-ref loop: `snapshot -i` → model picks `@eN` → execute |
| Bounds | Both agent action budget and per-Gherkin-step time budget per behavior |
| Defaults | `maxStepDurationMs: 60_000`, `maxSteps: 15` |
| Plan overrides | Per behavior; thinker proposes for heavy flows; user approves in Plan |
| Approach | Step-driven agent loop (not free-form scenario agent, not snapshot-then-batch-plan) |

## 5. Architecture

```text
Generate (unchanged)
  → Gherkin .feature per behavior

Plan (extended)
  → TestPlan.runConstraints: BehaviorRunConstraints[] per behavior
  → thinker proposes non-default limits for heavy flows

Run (rewritten)
  UiBrowserAdapter.#runUi
    → for each generated UI change:
        UiBrowserAgentRunner.runScenario({
          gherkinText,
          constraints,   // from plan by change.title
          targetUrl,
          onProgress,
          onScreenshot,
        })
          parse Gherkin → step queue
          loop until scenarioComplete or failure:
            enforce budgets (time + iterations)
            agent-browser snapshot -i
            AgentModelRunner.decideNext(context)
            UiBrowserAgentExecutor.execute(action)
            handle stepComplete / assertThen / stepFailed
          return ScenarioRunResult
```

### Removed

- `UiBrowserRunPlan` schema and one-shot plan generation
- `guardrail-skills/test-run-ui-browser.md`
- `buildRunPlan()`, `run-plan-context.ts`, `parseScenarioRunPlan()` as run path
- Batch `find role/text` planning upfront

### Added

- `UiBrowserAgentRunner` — owns loop, budgets, step advancement
- `UiBrowserAgentExecutor` — maps `UiBrowserAgentAction` → `agent-browser` CLI
- `GherkinStepParser` — extracts Given/When/Then/And/But
- `AgentModelRunner` — per-iteration structured model call
- `guardrail-skills/test-run-ui-browser-agent.md`
- `BehaviorRunConstraints` on `TestPlan`

### Unchanged

- Six-step workbench flow
- Dev server orchestration (`DevServerOrchestrator`)
- SSE events (`progress`, `screenshot`, `thinking`, `result`)
- Artifact serving
- Generate Gherkin output (`test-generate-ui-browser.md`)

## 6. Gherkin Step Flow

### Parsing

`GherkinStepParser` produces:

```ts
type GherkinStepKind = 'Given' | 'When' | 'Then' | 'And' | 'But';

interface GherkinStep {
  index: number;
  kind: GherkinStepKind;
  effectiveKind: 'Given' | 'When' | 'Then';  // And/But inherit prior kind
  text: string;
}
```

`And` / `But` inherit the effective kind of the previous non-And/But step.

### Step completion rules

| Step kind | Completion |
|-----------|------------|
| `Given` | Agent sets up preconditions (navigate, wait); emits `stepComplete` |
| `When` | Agent performs user action(s) via snapshot refs; emits `stepComplete` |
| `Then` | Agent emits `assertThen` with `satisfied: boolean` and `reason` |

A `Then` with `satisfied: false` fails the scenario immediately. Overall pass requires all `Then` steps to have `satisfied: true`.

## 7. Agent Action Schema

Per iteration the coder model returns exactly one `UiBrowserAgentAction`:

```ts
type UiBrowserAgentAction =
  | { kind: 'open'; path: string }
  | { kind: 'wait'; load: 'networkidle' | 'domcontentloaded' }
  | { kind: 'click'; ref: string }           // e.g. "@e4"
  | { kind: 'fill'; ref: string; value: string }
  | { kind: 'screenshot'; label: string }
  | { kind: 'stepComplete'; stepIndex: number; note: string }
  | { kind: 'assertThen'; stepIndex: number; satisfied: boolean; reason: string }
  | { kind: 'stepFailed'; stepIndex: number; reason: string }
  | { kind: 'scenarioComplete' };
```

### Snapshot-ref execution

```text
agent-browser snapshot -i     → accessibility tree with @e1, @e2, ...
agent-browser click @e4
agent-browser fill @e2 "value"
```

The runner snapshots **before** each model decision. Stale refs are recovered on the next iteration within budget.

### Model context per iteration

```json
{
  "scenarioTitle": "string",
  "gherkinSteps": [],
  "currentStepIndex": 1,
  "completedSteps": [{ "index": 0, "note": "Opened home page" }],
  "thenVerdicts": [],
  "pageSnapshot": "accessibility tree text",
  "actionHistory": [
    { "iteration": 1, "action": "open /", "result": "ok" }
  ],
  "constraints": { "maxStepDurationMs": 60000, "maxSteps": 15 },
  "elapsedMs": 4200,
  "iterationsUsed": 3
}
```

## 8. Plan-Step Run Constraints

```ts
interface BehaviorRunConstraints {
  behavior: string;        // matches isolation classification / change.title
  maxStepDurationMs: number; // default 60_000
  maxSteps: number;        // default 15
  reason?: string;         // shown in Plan when non-default
}
```

- Stored on `TestPlan.runConstraints: BehaviorRunConstraints[]`.
- Plan thinker proposes overrides only for heavy flows (slow API, multi-page checkout).
- `test-plan-builder` seeds defaults for every scoped behavior.
- User reviews overrides in Plan step before Generate/Run.
- At Run, `UiBrowserAgentRunner` looks up constraints by `change.title`.

### Plan UI

Under each behavior title in proposed actions:

- Default: show nothing or `60s per step / 15 actions`
- Override: `60s per step / 25 actions — polls payment status`

## 9. Run Output and SSE

### Progress messages

Reuse existing `progress` events with richer `message` text:

```text
[Scenario 2/4] Step 2/3 (When): snapshot captured
[Scenario 2/4] Iteration 4: click @e7
[Scenario 2/4] Then verdict: FAILED — products page not reached
```

Optional `thinking` events for short agent notes (no full snapshot in UI).

### Scenario result

```ts
interface ThenVerdict {
  stepIndex: number;
  text: string;
  satisfied: boolean;
  reason: string;
  screenshotLabel?: string;
}

interface ScenarioRunResult {
  outcome: RunOutcome;
  durationMs: number;
  evidence: Evidence[];
  thenVerdicts: ThenVerdict[];
  reason: string | null;
  iterationsUsed: number;
  constraintsApplied: BehaviorRunConstraints;
}
```

### Matrix mapping

`TestResultRow` shape unchanged:

| Field | Source |
|-------|--------|
| `reason` | First failed `Then` verdict, or budget/abort message |
| `evidenceItems` | All scenario screenshots |
| `status` | `ScenarioRunResult.outcome` |

v1 does not add expandable per-`Then` rows; future enhancement.

## 10. Error Handling

| Condition | Outcome |
|-----------|---------|
| `agent-browser` command fails | Retry with fresh snapshot; fail if budget exhausted |
| Invalid model JSON | Retry once; then fail |
| Step budget exceeded | `Failed: exceeded max N agent steps` |
| Step time budget exceeded | `Failed: exceeded max step duration` |
| `assertThen satisfied: false` | Immediate fail with agent reason |
| `stepFailed` | Immediate fail with reason |
| User abort | `AbortError`; partial evidence kept |
| LLM not configured | Job fails with config error |
| Dev server unavailable | Job fails before scenarios |

## 11. Browser Session

- One `agent-browser` session per scenario (per generated UI change).
- Reset between scenarios to avoid state bleed.

## 12. Module Layout

```text
backend/src/modules/workbench/
  adapters/ui-browser/
    ui-browser.adapter.ts
    ui-browser-agent-runner.ts       # NEW
    ui-browser-agent-executor.ts     # NEW
    gherkin-step-parser.ts           # NEW
    ui-browser-scenario.ts           # keep scenarioTextFromChange only
    ui-browser-evidence.ts           # unchanged
    ui-browser-runner.ts             # REMOVE after migration

  model/
    agent-model-runner.ts            # NEW
    structured-model-runner.ts       # unchanged

  plan/
    test-plan-builder.ts             # seed runConstraints

  run/
    run-plan-builder.ts              # REMOVE
    run-plan-context.ts              # REMOVE

  validation/workbench-validators.ts # swap schemas

guardrail-skills/
  test-run-ui-browser-agent.md       # NEW
  test-run-ui-browser.md             # REMOVE
  test-plan.md                       # extend for runConstraints

frontend/
  types/testlens.ts                  # BehaviorRunConstraints on TestPlan
  pages/generate-tests/steps/plan-step.tsx  # show overrides
```

## 13. Skill: test-run-ui-browser-agent

Instructs the coder model to:

- Read the current Gherkin step and full scenario for context.
- Use only `@eN` refs from the provided `pageSnapshot`.
- Never invent CSS selectors or guessed text strings.
- Call `assertThen` only for `Then` steps, with honest `satisfied`/`reason`.
- Capture `screenshot` after meaningful state changes.
- Call `stepComplete` when a non-Then step is done.
- Call `scenarioComplete` only when all steps including all `Then`s are satisfied.

## 14. Testing

| Test file | Coverage |
|-----------|----------|
| `gherkin-step-parser.test.ts` | Step extraction, And/But inheritance |
| `ui-browser-agent-executor.test.ts` | Action → CLI args |
| `ui-browser-agent-runner.test.ts` | Loop, budgets, Then verdicts, failure reasons |
| `ui-browser.adapter.test.ts` | Constraints wiring, matrix output |
| `test-plan-builder.test.ts` | Default and merged runConstraints |

Inject fake model and fake executor — no live `agent-browser` in CI.

## 15. Migration

1. Implement behind `GUARDRAIL_AGENTIC_UI_RUN=1` (default on in development).
2. Ship agent path; validate against ecommerce and onboarding repos.
3. Remove batch path, `UiBrowserRunPlan`, and deprecated skills/files.

## 16. Out of Scope (v1)

- Vision/screenshot-based assertions
- Expandable per-`Then` matrix rows in frontend
- Persistent run transcripts beyond session
- Changes to Generate Gherkin format
- Non-UI-Browser adapters
- Text/role fallback when refs fail (snapshot-only recovery within budget)

## 17. Success Criteria

- UI scenarios pass when the page visibly satisfies Gherkin `Then` clauses.
- Failures cite the specific `Then` or budget that failed, not a pre-planned wrong selector.
- Plan step shows per-behavior time/step overrides when the thinker proposes them.
- Run progress stream shows agent iterations readable by a human reviewer.
- Existing six-step workbench UX unchanged.
