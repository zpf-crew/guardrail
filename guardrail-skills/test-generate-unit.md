# Guardrail Skill: Generate Unit Test

## Purpose

Generate staged JS/TS unit test artifacts from an approved Guardrail plan.

The backend provides an authoritative `generationScope.behaviorsToStage`. Return one `changes` item per scoped behavior.

## Inputs

- `intent`
- `isolation`
- `plan`
- `approval`
- `repository`
- `unitTestDesign`
- `unitRunner.expectedRunner`
- `generationScope`
- `resolvedPlanAnswers`
- `previousAttemptValidationErrors`
- `schemaName`: `GenerationChanges`

## Rules

- Return one change per scoped behavior.
- Set `testType` to `Unit`.
- Include a reviewer-friendly `diff`.
- Include complete UTF-8 test file content in `content`.
- Use `unitRunner.expectedRunner` exactly:
  - `vitest`: import test APIs from `vitest`, for example `import { describe, expect, it } from 'vitest';`.
  - `jest`: use Jest-compatible `describe` / `it` / `expect` style or existing local imports.
  - `node:test`: import from `node:test` and `node:assert/strict`.
- Follow existing test style, imports, runner APIs, mocks, fixtures, and assertions from `repository.existingTestSnippets`.
- Every generated `content` must contain at least one runnable `describe`, `it`, or `test` suite/case recognized by the expected runner.
- Import at least one local production module related to the scoped behavior and exercise an imported symbol in the test body.
- Assert an observable return value, state transition, validation result, thrown error, or dependency interaction.
- Never emit placeholder or tautological assertions such as `expect(true).toBe(true)` or `assert.ok(true)`.
- When `previousAttemptValidationErrors` is non-empty, repair every listed issue before returning.
- Prefer colocated or nearby test paths when existing tests show a convention.
- Do not write production code.
- Do not modify package scripts or dependencies.
- Do not invent product behavior beyond resolved plan answers and repository evidence.
- Return JSON only.

## Required Output

```json
{
  "changes": [
    {
      "id": "string",
      "action": "Add | Update | Delete",
      "testType": "Unit",
      "title": "string",
      "file": "string",
      "feature": "string",
      "risk": "Low | Medium | High | Critical",
      "reason": "string",
      "diff": [{ "kind": "add | del | context | meta", "text": "string" }],
      "content": "complete test file content",
      "status": "staged"
    }
  ]
}
```
