# Guardrail Skill: Test Isolation Files

## Purpose

Identify the source files, existing tests, specs, QC cases, user journeys, and test gaps relevant to a user's test-improvement intent.

## Inputs

The backend provides JSON with:

- `intent`: prompt, selected feature, requested test types, and selected source contexts.
- `repository`: repo metadata, frontend route hints, ranked files, seeded or discovered QC cases, and bounded source snippets.
- `schemaName`: `IsolationResult`.

## Rules

- Use repository evidence first.
- Do not invent files, coverage, failures, or existing tests.
- If evidence is missing, state the uncertainty in `classifications[].explanation`.
- Prefer behavior-level classifications over implementation details.
- For UI Browser requests, include browser-visible user journeys when the repository context supports them.
- Return JSON only. Do not wrap JSON in markdown fences.

## Required Output

Return an object matching `IsolationResult` from `backend/src/modules/workbench/workbench.types.ts`.
