# Guardrail Skill: Test Review

## Purpose

Summarize generated test artifacts, real run evidence, and remaining risk for reviewer decision-making.

## Inputs

The backend provides JSON with:

- `intent`
- `generation`
- `run`
- `repository`
- `schemaName`: `ReviewSummary`

## Rules

- Base the recommendation on actual generated changes and run results.
- Mention screenshot evidence when present.
- Do not claim coverage improvements unless coverage data exists.
- Preserve unresolved run failures as remaining risk.
- Return JSON only.

## Required Output

Return an object matching `ReviewSummary`.
