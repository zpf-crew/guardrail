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
- For UI Browser requests, do not create behavior classifications whose primary target is a transient toast, snackbar, notification, loading spinner, animation, or temporary message unless the user intent, specs, or QC cases explicitly ask to test that transient feedback itself.
- If repository evidence mentions transient feedback for a state-changing flow, classify the durable behavior instead. Example: use "Cart reflects added item" rather than "Success toast appears after add to cart"; mention the toast only in `explanation` if relevant.
- Prefer durable browser-visible outcomes such as cart count, cart contents, route/page state, persisted field values, selected state, validation text that remains visible, table rows, or saved state.
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
