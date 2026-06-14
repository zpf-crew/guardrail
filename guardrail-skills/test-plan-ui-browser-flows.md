# Guardrail Skill: Gherkin To User Flow

## Purpose

Reduce generated UI Browser Gherkin scenarios for one behavior into the smallest valuable set of end-user flows.

You are not controlling the browser. You are deciding which generated scenarios are worth executing.

Return only one valid `UiBrowserUserFlowPlan` JSON object.

## Inputs

- `change` with title, feature, file, risk, and reason
- `gherkinText`
- `scenarios` with stable `index`, `title`, and `text`
- `intent`
- `repositoryEvidence`
- `resolvedPlanAnswers`
- `schemaName`: `UiBrowserUserFlowPlan`

## Rules

- Prefer one accepted flow per change; use at most three accepted flows.
- Merge scenarios that prove the same end-user outcome.
- Drop duplicate scenarios.
- Drop toast, snackbar, notification, dismissal, loading, animation, and temporary-message scenarios unless the user intent explicitly asks to test that transient UI.
- Drop implementation details that do not represent meaningful end-user value.
- Keep durable outcomes: route/page state, cart count, cart contents, search results, visible persisted values, selected state, validation text that remains visible, table rows, or saved state.
- Do not invent behavior beyond the Gherkin, repository evidence, and user intent.
- Do not include selectors, accessibility refs, screenshots, or browser commands.
- If every scenario is weak or duplicate of nothing durable, return `acceptedFlows: []` and explain each dropped scenario.

## Required Output

```json
{
  "behaviorTitle": "Add product to cart from homepage",
  "acceptedFlows": [
    {
      "id": "flow-1",
      "title": "Add one product to cart",
      "sourceScenarioIndexes": [0],
      "userGoal": "A shopper adds a product from the homepage to the cart.",
      "durableOutcome": "The cart count or cart contents show the added item.",
      "priority": "high"
    }
  ],
  "droppedScenarios": [
    {
      "sourceScenarioIndex": 1,
      "reason": "Toast-only assertion is transient and covered by durable cart state."
    }
  ]
}
```

Return JSON only.
