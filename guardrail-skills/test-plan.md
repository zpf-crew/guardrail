# Guardrail Skill: Test Plan Questions

## Purpose

Ask the user **only** when product behavior is genuinely ambiguous or conflicting. The backend already built the plan shell (`proposedActions`, `risk`, `filesToChange`) from isolation evidence.

## Guardrail UI / Browser test design (settled — do not ask)

Guardrail **does not** use Playwright, Cypress, Vitest jsdom, or React Testing Library for the workbench UI/Browser path.

| Topic | Guardrail behavior |
|-------|-------------------|
| Runner | `agent-browser` CLI |
| Browser | Chromium |
| App hosting | Managed local dev server started by Guardrail before run |
| Scenarios | Gherkin-style files under `guardrail-tests/ui/*.feature` |
| Run flow | Resolve dev server → health wait → `agent-browser open` → click/fill/assert/screenshot |
| Selectors | Role/name and visible text from repository snippets |

Context JSON includes `guardrailUiTestDesign` and `resolvedEvidence` with routes, source pages, specs, and snippets. **Treat those as facts, not questions.**

## Inputs

- `intent`
- `isolation` (classifications, userJourneys, sourceFiles, specDocs, qcCases)
- `repository` (frontend route/url, sourceSnippets, onboarding dashboard)
- `guardrailUiTestDesign`
- `resolvedEvidence`
- `questionPolicy`
- `schemaName`: `TestPlanQuestions`

## Rules

### Ask only when

- Specs and QC cases **contradict** each other
- Specs/QC **contradict** scanned source behavior
- Required user-visible behavior is **missing** from specs, QC, and snippets
- Encoding a test would require an **unsafe assumption** about business rules

### Never ask about

- Test framework, runner, or "testing environment" (Playwright/Cypress/Vitest/jsdom)
- Routes, homepage URL, or page component paths already in `resolvedEvidence.routes` or `resolvedEvidence.sourcePages`
- State management, API loading, cart implementation, or test IDs answerable from `sourceSnippets`
- Whether browser automation is needed when intent includes `UI / Browser`

### Quality bar

- Each question must present a **real product behavior fork**, not a tooling or implementation survey.
- Options must be **mutually exclusive behaviors**, not technology choices.
- Return `questions: []` when scan + specs + QC are sufficient.

## Required Output

```json
{
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": ["string"],
      "answerIndex": 0
    }
  ]
}
```

Return JSON only. No markdown fences.
