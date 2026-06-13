# Guardrail Skill: Test Isolation Files

## Purpose

Classify behavior-level test gaps relevant to a user's test-improvement intent using repository evidence that was already scanned by the backend.

## Inputs

The backend provides JSON with:

- `intent`: prompt, selected feature, requested test types, and selected source contexts.
- `repository`: repo metadata, ranked files, snippets, QC cases, and onboarding dashboard context.
- `schemaName`: `IsolationClassifications`.

## Rules

- Use repository evidence first.
- Do not invent files, coverage numbers, failures, or existing tests.
- Return **classifications only**. The backend fills `target`, file lists, coverage, status, and user journeys from deterministic scan data.
- Prefer behavior-level classifications over implementation details.
- For UI Browser requests, include browser-visible user journeys in `behavior` or `explanation` when supported by repository context.
- Return JSON only. Do not wrap JSON in markdown fences.

## Required Output

Return an object matching:

```json
{
  "classifications": [
    {
      "behavior": "string",
      "status": "Covered | Missing | Weak | Failed | Suspicious",
      "suggestedTypes": ["UI / Browser"],
      "risk": "Low | Medium | High | Critical",
      "explanation": "string"
    }
  ]
}
```

- Return one classification per distinct user-visible behavior supported by evidence
- For UI/Browser intents prefer browser-visible journeys
- At least one only when evidence is extremely sparse
