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
- Assertion `successCriteria` must not require exact names, IDs, SKUs, product names, order numbers, usernames, repository names, or other identity values unless that exact value is grounded in `sourceScenarios`, `repositoryEvidence`, resolved user answers, or created earlier in the same plan. Prefer durable behavior assertions such as item count, non-empty results, route, persisted field value, "the selected item appears", or "the added item appears".
- Each plan runs in a fresh browser session. Do not assume cart contents, wishlist contents, selected variants, form values, search state, login state, or other state from a previous scenario.
- If the flow depends on state such as an item in the cart, an item in the wishlist, a selected variant, or an existing row, add action steps that create or ground that state inside this same plan before asserting or mutating it.
- Include natural scroll guidance when a control may be below the fold.
- Do not include selectors, accessibility refs, or private knowledge about a specific test repository.

## Repair Mode

When `generatedPlan` is present, repair that plan instead of creating an unrelated new one.

- Return the same plan if it already follows every rule.
- Otherwise return a corrected full `UiBrowserExecutionPlan`.
- Preserve the same `flowId`, title, and user goal unless they conflict with the rules.
- Move any interaction hidden inside an `assert` step into one or more preceding `action` steps.
- Remove wrong-state steps from the repaired plan. A wrong-state step is any step that clicks, decrements, removes, edits, checks out, submits, or asserts against data that was never created, selected, or grounded earlier in the same fresh-session plan.
- If a wrong-state plan can be repaired within five steps, add the missing setup first. Example: replace "Open cart, click minus, assert item count decreased" with a self-contained flow that opens a product, adds it to cart, opens the cart, clicks minus, and verifies the cart count changes.
- If the required precondition cannot be created or grounded within five steps, do not preserve the impossible action or assertion. Return the shortest self-contained plan for the same feature area that verifies a durable default state or setup outcome.
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
