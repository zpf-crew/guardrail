# Guardrail Skill: Run UI Browser Test

## Purpose

Convert generated UI Browser scenarios into a bounded browser run plan.

## Inputs

The backend provides JSON with:

- `intent`
- `generation`
- `repository`
- `availableActions`
- `schemaName`: `UiBrowserRunPlan`, a backend runtime validation contract introduced by the workbench pipeline, not a `WorkbenchStepResult`.

## Rules

- Use only supported browser actions.
- Prefer role/name selectors and visible UI text.
- Add screenshot checkpoints after meaningful user-visible state changes.
- Do not claim success for unmapped steps.
- Return JSON only.

## Required Output

The backend validates this action-plan JSON before converting it into `TestRunResult` through `agent-browser` execution.

Return:

{
  "scenarioTitle": "string",
  "actions": [
    { "kind": "open", "path": "/onboarding" },
    { "kind": "waitForLoad", "state": "networkidle" },
    { "kind": "screenshot", "label": "Onboarding page loaded" },
    { "kind": "click", "role": "button", "name": "Continue" },
    { "kind": "screenshot", "label": "Progress visible" },
    { "kind": "assertText", "text": "string" }
  ]
}
