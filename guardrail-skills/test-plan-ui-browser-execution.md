# Guardrail Skill: User Flow To Execution

## Purpose

Turn one accepted UI Browser user flow into a short human-QC execution plan.

You are not controlling the browser. You are writing concise setup/action/assert steps for the browser agent.

Return only one valid `UiBrowserExecutionPlan` JSON object.

## Inputs

- `flow`
- `sourceScenarios`
- `repositoryEvidence`
- `defaultRoute`
- `agentBrowserGuidance`
- `generatedPlan` (optional) — a previously generated plan to repair
- `schemaName`: `UiBrowserExecutionPlan`

## Rules

- Target three steps for normal flows.
- Never exceed five steps.
- Use only `setup`, `action`, and `assert`.
- Keep one user intent per action step.
- Put every user interaction in an `action` step, including opening detail pages, clicking buttons or links, selecting variants, filling fields, pressing keys, submitting forms, adding items, removing items, and navigating within the app.
- `assert` steps are verification-only. Do not put action verbs such as open, click, select, choose, fill, type, press, submit, add, remove, navigate, or go to in an `assert` instruction or `successCriteria`.
- If a flow needs multiple interactions before verification, create multiple `action` steps before the final `assert` step. Use `And`-style action sequencing conceptually by adding another `action` step; never hide later clicks inside an assertion.
- Do not create screenshot steps; the runner captures evidence automatically.
- Do not split "fill search and submit" unless the UI clearly requires separate user actions.
- Assertions must be durable and decisive after at most one observation.
- Do not include toast, snackbar, notification, loading, spinner, animation, fade, disappears, cleanup, or exploratory checks in any `instruction` or `successCriteria` unless the accepted flow specifically exists to test that transient behavior.
- Action `successCriteria` must be mechanical and brief, such as "The click completes", "The route changes", "The results load", or "The page state is ready for the next assertion".
- Assertion `successCriteria` must be durable, such as cart count, cart contents, route, heading, persisted field value, search result text, table row, or saved state.
- Include natural scroll guidance when a control may be below the fold.
- Do not include selectors, accessibility refs, or private knowledge about a specific test repository.

## Repair Mode

When `generatedPlan` is present, repair that plan instead of creating an unrelated new one.

- Return the same plan if it already follows every rule.
- Otherwise return a corrected full `UiBrowserExecutionPlan`.
- Preserve the same `flowId`, title, and user goal unless they conflict with the rules.
- Move any interaction hidden inside an `assert` step into one or more preceding `action` steps.
- Keep or create one final durable `assert` step after the needed actions.
- Keep the repaired plan within five total steps.

## Required Output

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
      "instruction": "Open the first product detail page.",
      "successCriteria": "The product detail page opens."
    },
    {
      "id": "step-3",
      "kind": "action",
      "instruction": "Click Add to Cart, scrolling if needed.",
      "successCriteria": "The click completes."
    },
    {
      "id": "step-4",
      "kind": "assert",
      "instruction": "Verify the cart reflects one added item.",
      "successCriteria": "The cart count or cart contents show one item."
    }
  ]
}
```

Return JSON only.
