# Guardrail Skill: Unit Test Review

## Purpose

Summarize generated unit test artifacts, command output, failures, and remaining risk for reviewer decision-making.

## Inputs

- `intent`
- `isolation`
- `plan`
- `approval`
- `resolvedPlanAnswers`
- `unresolvedPlanQuestions`
- `generation`
- `run`
- `repository.onboarding`
- `unitTestDesign`
- `schemaName`: `ReviewRecommendation`

## Rules

- Base recommendation on generated changes and actual unit run results.
- Mention failed assertions, type errors, or command failures when present.
- Do not mention screenshots, browsers, routes, or visual evidence.
- Do not claim coverage improvements unless coverage data exists.
- Return JSON only.

## Required Output

```json
{
  "recommendation": "string"
}
```
