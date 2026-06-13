# Guardrail Skill: Test Plan

## Purpose

Turn an approved isolation result into a reviewable test-improvement plan.

## Inputs

The backend provides JSON with:

- `intent`
- `isolation`
- `repository`
- `schemaName`: `TestPlan`

## Rules

- Every proposed action must map to an isolated behavior or gap.
- Mark `browserAutomationRequired` true when UI Browser tests are planned.
- Set `productionCodeChanges` to `none` unless the evidence proves production code must change.
- Keep files reviewable and scoped to test artifacts.
- Ask questions only when a missing product behavior would make the test unsafe to generate.
- Return JSON only.

## Required Output

Return an object matching `TestPlan`.
