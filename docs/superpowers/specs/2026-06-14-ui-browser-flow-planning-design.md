# UI Browser Flow Planning Design

## Context

Guardrail's UI Browser runner currently executes generated Gherkin scenarios too directly. Recent fixes added a per-scenario planner and a lexical grounding guard, but the guard rejects normal human testing language such as "display", "view", and "added". When that happens, the runner falls back to raw Gherkin and executes noisy generated scenarios one by one.

The result is slow and brittle: duplicate scenarios run separately, transient toast checks reach the browser runner, and the model can spend many turns observing instead of making a decisive pass/fail call. The product behavior may work manually, but the generated execution surface is larger and weaker than what a human QC tester would actually run.

## Goal

Make UI Browser execution simple, durable, and end-user focused.

Generated Gherkin should be treated as draft test intent, not as the final execution contract. Before opening the browser, Guardrail should reduce generated scenarios into the smallest valuable set of user flows, drop weak or duplicate scenarios, and execute only concise durable flows.

## Non-Goals

- Do not add static regex verdicts for cart, search, toast, or product-specific assertions.
- Do not hard-code behavior for one test repository.
- Do not make every generated scenario executable.
- Do not use screenshots as planned steps; screenshots remain automatic evidence.
- Do not silently fall back to running all raw Gherkin scenarios when planning fails.

## Proposed Pipeline

The normal UI Browser run path becomes:

1. Generate Gherkin drafts from the approved Guardrail plan.
2. Convert all Gherkin scenarios for a generated change into user-value flows.
3. Drop or merge weak, duplicate, brittle, or non-user-value scenarios.
4. Convert each accepted flow into a short execution plan.
5. Execute only those execution plans with `agent-browser`.
6. Report executed flows, skipped/dropped scenarios, screenshots, and raw traces as evidence.

This replaces the current model of executing each generated Gherkin scenario independently.

## Skill 1: Gherkin To User Flow

Create a new skill named `guardrail/gherkin-to-user-flow`.

Purpose: reduce all generated Gherkin scenarios for one behavior/change into the smallest valuable set of user flows.

Input:

- Generated change title, feature, file path, and risk.
- Full generated Gherkin text for that change.
- Scenario list with stable source indexes.
- Repository scan evidence already available to the workbench.
- User intent and resolved plan answers.

Output:

```json
{
  "behaviorTitle": "Add product to cart from homepage",
  "acceptedFlows": [
    {
      "id": "flow-1",
      "title": "Add one product to cart",
      "sourceScenarioIndexes": [0, 1],
      "userGoal": "A shopper adds a product from the homepage to the cart.",
      "durableOutcome": "The cart count or cart contents show the added item.",
      "priority": "high"
    }
  ],
  "droppedScenarios": [
    {
      "sourceScenarioIndex": 8,
      "reason": "Toast-only assertion is transient and covered by durable cart state."
    }
  ]
}
```

Rules:

- Prefer one accepted flow per generated change; allow up to three when the behavior truly has distinct user outcomes.
- Merge scenarios that prove the same user outcome.
- Drop duplicate scenarios.
- Drop toast, snackbar, notification, dismissal, loading, animation, and temporary-message scenarios unless the user's intent explicitly asks to test that transient UI.
- Drop implementation detail scenarios that do not represent a meaningful end-user outcome.
- Keep durable outcomes such as route/page state, cart count, cart contents, search results, visible persisted values, selected state, validation text that remains visible, table rows, or saved state.
- Do not invent app-specific behavior beyond the Gherkin, repository evidence, and user intent.
- Do not include selectors, accessibility refs, screenshots, or browser commands.

If all scenarios are dropped, the run result should show the behavior as skipped with the drop reasons. It should not be marked passed.

## Skill 2: User Flow To Execution

Create a new skill named `guardrail/user-flow-to-execution`.

Purpose: turn one accepted user flow into a concise browser execution plan.

Input:

- One accepted flow from `guardrail/gherkin-to-user-flow`.
- Its source Gherkin scenarios.
- Repository scan evidence and route evidence.
- Agent Browser command guidance.

Output:

```json
{
  "flowId": "flow-1",
  "title": "Add one product to cart",
  "steps": [
    {
      "id": "step-1",
      "kind": "setup",
      "instruction": "Open the homepage.",
      "successCriteria": "The homepage is loaded."
    },
    {
      "id": "step-2",
      "kind": "action",
      "instruction": "Find the first Add to Cart button, scrolling if needed, and click it.",
      "successCriteria": "The click completes."
    },
    {
      "id": "step-3",
      "kind": "assert",
      "instruction": "Verify the cart reflects one added item.",
      "successCriteria": "The cart count or cart contents show one item."
    }
  ]
}
```

Rules:

- Target three steps for normal flows.
- Soft maximum is five steps.
- Use only `setup`, `action`, and `assert`.
- Keep one user intent per action step.
- Do not create screenshot steps; the runner captures screenshots automatically.
- Do not split "fill search and submit" unless the UI clearly requires separate user actions.
- Assertions must be decisive after at most one observation.
- Do not include toast, loading, animation, cleanup, or exploratory checks unless the accepted flow specifically exists to test that behavior.
- Include natural scroll guidance when a control may be below the fold.

## Runner Behavior

The runner should execute execution plans, not raw Gherkin, in the normal path.

Step handling should be stricter:

- `setup`: navigate or prepare initial page state, then complete.
- `action`: perform the requested user action, then complete after the primary browser action succeeds.
- `assert`: observe durable state and return a pass/fail verdict.

The runner should minimize model turns:

- Complete action steps after a successful primary action.
- Capture screenshots automatically after meaningful state changes and on failure.
- For assert steps, allow at most one observation command before requiring a verdict.
- Reject mutating browser commands during assert steps unless the step explicitly requires navigation to inspect durable state.
- Do not repeat screenshots or snapshots on the same assert step.

Progress output should show high-signal events only:

- Flow planning summary.
- Dropped scenario summary.
- Browser actions.
- Assertion pass/fail.
- Flow complete.

It should hide planning chatter and repeated observation internals unless a failure trace is being reviewed.

## Failure Handling

If `guardrail/gherkin-to-user-flow` fails, Guardrail should not run every raw scenario as a fallback. It should mark the behavior failed with `Flow planning failed`, attach the raw trace, and avoid spending slow browser time on noisy drafts.

If `guardrail/user-flow-to-execution` fails for one accepted flow, Guardrail should skip that flow with a planning error and continue other accepted flows for the same run.

If a browser action fails, only that flow should fail. The result should include the command, failure detail, screenshot evidence, and raw trace.

If all scenarios are dropped, the behavior should be `Skipped` with clear reasons.

Dropped scenarios should be visible evidence. Each dropped source scenario should appear as a `Skipped` matrix row with the drop reason and source file, so reviewers can see why generated scenarios were not executed.

## Remove Current Grounding Guard

The lexical grounding guard in `ui-browser-scenario-plan.ts` should be removed from the normal path. It rejects valid human testing language and causes the simplification layer to be bypassed.

Grounding should instead come from the structured flow review:

- accepted flows must cite source scenario indexes;
- dropped scenarios must cite source scenario indexes and reasons;
- execution plans are derived from accepted flows, not directly from free-form raw Gherkin.

This preserves traceability without rejecting normal QC language.

## Data Model Changes

Add validation schemas for:

- `UiBrowserUserFlowPlan`
- `UiBrowserAcceptedFlow`
- `UiBrowserDroppedScenario`
- `UiBrowserExecutionPlan`
- `UiBrowserExecutionStep`

Run results should support evidence for:

- raw generated Gherkin source;
- accepted flow plan;
- dropped scenario reasons;
- execution plan;
- raw browser trace;
- screenshots.

Matrix rows should distinguish:

- `Passed`: executed flow passed.
- `Failed`: executed flow failed or planning failed.
- `Skipped`: generated scenario or flow intentionally dropped before browser execution.

## Testing Strategy

Unit tests for flow planning orchestration:

- duplicate scenarios merge into one accepted flow;
- toast-only scenarios are dropped;
- mixed durable and transient scenarios keep the durable flow and drop transient checks;
- planning failure does not execute all raw Gherkin scenarios;
- all-dropped scenarios produce skipped evidence, not passed status.

Unit tests for execution planning orchestration:

- accepted flow becomes runner input;
- setup/action/assert kinds are preserved;
- normal flows stay within three to five steps;
- screenshot steps are not required.

Runner tests:

- action step completes after successful click or fill;
- assert step requires a verdict after one observation;
- assert step rejects mutation commands;
- dropped scenario evidence appears in matrix results;
- browser failure fails only the current flow.

End-to-end smoke fixture:

- generated cart/search Gherkin with duplicate and toast scenarios should reduce to one cart flow and one search flow;
- toast scenarios should be reported as dropped;
- the browser should execute only the accepted flows.

## Success Criteria

- A generated run with ten noisy cart/search/toast scenarios executes only the smallest useful set of durable flows.
- Toast-only and toast-dismissal scenarios are dropped unless explicitly requested by the user.
- Duplicate cart/search scenarios are merged before browser execution.
- Normal add-to-cart/search flows finish with fewer model turns and fewer browser actions.
- Progress logs are readable and reflect real user actions, not repeated planning or observation loops.
- Reviewers can see exactly which generated scenarios were executed, merged, or dropped.
