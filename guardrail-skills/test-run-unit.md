# Guardrail Skill: Unit Test Run Plan

## Purpose

Plan how Guardrail should run a generated JS/TS unit test in the isolated worktree.

The backend validates and executes commands deterministically. Your job is to provide structured guidance, not shell commands.

## Inputs

- `change`: generated unit test change.
- `repository`: package metadata, source snippets, existing test snippets.
- `unitTestDesign`
- `commandCandidates`
- `schemaName`: `UnitRunPlan`.

## Rules

- Prefer running only the generated test file.
- Use existing test/package evidence to identify likely runner.
- Do not request browser or UI automation.
- Do not include arbitrary shell commands.
- Return JSON only.

## Required Output

```json
{
  "packageRoot": ".",
  "generatedTestPath": "relative/path/to/generated.test.ts",
  "focused": true,
  "setupNotes": ["string"],
  "expectedRunner": "node:test | vitest | jest | unknown"
}
```
