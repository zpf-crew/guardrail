# Guardrail Skill: Unit Test Plan Questions

## Purpose

Ask the user only when product behavior is genuinely ambiguous or conflicting before unit tests are generated.

## Settled Unit Test Design

Guardrail's Unit workbench path generates JS/TS unit test files, runs them in an isolated temporary git worktree, and applies them to the real repo only after user approval.

## Inputs

- `intent`
- `isolation`
- `repository`
- `unitTestDesign`
- `resolvedEvidence`
- `questionPolicy`
- `schemaName`: `TestPlanQuestions`

## Rules

### Ask only when

- Specs and QC cases contradict each other.
- Specs/QC contradict scanned source behavior.
- Encoding an assertion would require an unsafe product assumption.
- Expected error behavior, boundary behavior, or validation semantics are not discoverable from source/spec/QC evidence.

### Never ask about

- Browser, routes, screenshots, or UI automation.
- Whether Guardrail should use Jest, Vitest, or node:test when package metadata and existing tests already indicate the runner.
- File placement when existing tests or package structure are sufficient.
- Mocking details that can be copied from existing test snippets.

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

Return `{"questions":[]}` when evidence is sufficient.
