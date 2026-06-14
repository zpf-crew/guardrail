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
- `schemaName`: `UiBrowserExecutionPlan`

## Rules

- Target three steps for normal flows.
- Never exceed five steps.
- Use only `setup`, `action`, and `assert`.
- Keep one user intent per action step.
- Do not create screenshot steps; the runner captures evidence automatically.
- Do not split "fill search and submit" unless the UI clearly requires separate user actions.
- Assertions must be durable and decisive after at most one observation.
- Do not include toast, loading, animation, cleanup, or exploratory checks unless the accepted flow specifically exists to test that behavior.
- Include natural scroll guidance when a control may be below the fold.
- Do not include selectors, accessibility refs, or private knowledge about a specific test repository.

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

Return JSON only.
