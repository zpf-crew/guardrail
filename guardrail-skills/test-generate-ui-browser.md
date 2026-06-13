# Guardrail Skill: Generate UI Browser Test

## Purpose

Generate staged, human-readable UI Browser test artifacts from a validated Guardrail plan.

## Inputs

The backend provides JSON with:

- `intent`
- `isolation`
- `plan`
- `repository`
- `approval`
- `schemaName`: `GenerationResult`

## Rules

- Generate scenarios from the plan and repository snippets.
- Do not write production code.
- Use Gherkin-style language when it improves reviewer readability.
- Include enough scenario detail for the runner to map steps to browser actions.
- If approval cancels or skips UI Browser tests, return an empty `changes` array with a clear timeline and before/after summary.
- Return JSON only.

## Required Output

Return an object matching `GenerationResult`.
