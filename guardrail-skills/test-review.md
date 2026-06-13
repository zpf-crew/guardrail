# Guardrail Skill: Test Review

## Purpose

Summarize generated test artifacts, real run evidence, and remaining risk for reviewer decision-making.

## Inputs

The backend provides JSON with:

- `intent`
- `isolation`
- `plan`
- `approval`
- `resolvedPlanAnswers` — plan questions answered during approval
- `unresolvedPlanQuestions` — count of plan questions still without an answer
- `generation`
- `run`
- `repository.onboarding`
- `guardrailUiTestDesign`
- `schemaName`: `ReviewRecommendation`

## Rules

- Base the recommendation on actual generated changes and run results.
- Mention screenshot evidence when present.
- Do not claim coverage improvements unless coverage data exists.
- Preserve unresolved run failures as remaining risk.
- Call out unresolved plan questions when `unresolvedPlanQuestions` is greater than zero.
- Return **recommendation text only**. The backend fills counts, files, risk tiles, and `openQuestions` from run evidence and plan approval state.
- Return JSON only.

## Required Output

Return an object matching:

```json
{
  "recommendation": "string"
}
```
