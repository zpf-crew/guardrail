# Guardrail Skill: Generate UI Browser Test

## Purpose

Generate staged, human-readable UI Browser test artifacts from an **approved** Guardrail plan.

The backend already derived **which behaviors** to stage in `generationScope.behaviorsToStage`. Your job is to return one `changes` entry per scoped behavior with concrete Gherkin diffs.

## Guardrail UI / Browser test design (settled)

| Topic | Guardrail behavior |
|-------|-------------------|
| Runner | `agent-browser` CLI |
| Browser | Chromium |
| App hosting | Managed local dev server started by Guardrail before run |
| Scenarios | Gherkin-style files under `guardrail-tests/ui/*.feature` |
| Run flow | Dev server → health wait → `agent-browser open` → click/fill/assert/screenshot |
| Selectors | Role/name and visible text from `repository.sourceSnippets` |

Do **not** generate Playwright, Cypress, Vitest, jsdom, or React Testing Library tests.

## Inputs

- `intent`
- `isolation` (classifications, userJourneys, sourceFiles, specDocs, qcCases)
- `plan` (approved `proposedActions`, `filesToChange`)
- `approval`
- `repository` (frontend route/url, sourceSnippets, onboarding)
- `guardrailUiTestDesign`
- `generationScope.behaviorsToStage` — **authoritative list of behaviors to cover**
- `generationScope.minimumChangeCount`
- `generationPolicy`
- `schemaName`: `GenerationChanges`

## Rules

- Return **one `changes` item per entry** in `generationScope.behaviorsToStage`.
- Match each change `title` to the scoped `behavior` string.
- Use the scoped `file` path when the model is unsure.
- Set `action` from scope: `Add` for Missing, `Update` for Weak/Suspicious.
- Write Gherkin steps reviewers can map to browser actions (open page, click, fill, assert visible text).
- Use repository snippets for realistic labels, routes, and button text.
- Do not create required `Then` steps for transient toasts, snackbars, banners, or success notifications. These can disappear before the agent observes them. For state-changing flows, assert durable user-visible state instead, such as cart count, cart contents, route changes, saved item state, table rows, headings, or persisted form values.
- Never assert exact names, IDs, SKUs, product names, order numbers, usernames, repository names, or other identity values unless that exact value is present in repository evidence, specs, QC cases, resolved user answers, or was created earlier in the same scenario. If the data is unknown, assert behavior-level facts instead, such as a non-empty result list, count changes, route changes, the selected item appears in cart, or persisted state changes.
- Each generated scenario must be executable from a fresh browser session. Do not assume cart contents, wishlist contents, selected variants, form values, login state, or any other state created by a previous scenario unless the scenario itself creates that state first.
- Do not write production code.
- When `resolvedPlanAnswers` is non-empty, encode the selected product behavior in scenario steps and `reason` fields.
- Do not re-ask questions already answered in `resolvedPlanAnswers`.
- Return **changes only**. The backend fills `timeline` and `beforeAfter`.
- Return JSON only.

## Required Output

```json
{
  "changes": [
    {
      "id": "string",
      "action": "Add | Update | Delete",
      "testType": "UI / Browser",
      "title": "string — must match scoped behavior",
      "file": "string",
      "feature": "string",
      "risk": "Low | Medium | High | Critical",
      "reason": "string",
      "diff": [{ "kind": "add | del | context | meta", "text": "string" }],
      "status": "staged"
    }
  ]
}
```

If `generationScope.behaviorsToStage` has N items, return **N** changes (not 1).
