# Guardrail Skill: Unit Test Isolation

## Purpose

Classify behavior-level unit test gaps relevant to the user's intent using repository evidence already scanned by the backend.

## Inputs

The backend provides JSON with:

- `intent`: prompt, selected feature, requested test types, and selected source contexts.
- `repository`: repo metadata, ranked source files, existing test files, snippets, specs, QC cases, and onboarding context.
- `unitTestDesign`: settled facts for the Unit workbench path.
- `schemaName`: `IsolationClassifications`.

## Rules

- Use repository evidence first.
- Do not invent files, coverage numbers, failures, or existing tests.
- Prefer function, module, service, validation, error-handling, parsing, state transition, and edge-case behavior.
- Prefer unit-level assertions over browser-visible journeys.
- Return classifications only. The backend fills target, file lists, coverage, status, and journeys from deterministic scan data.
- Return JSON only. Do not wrap JSON in markdown fences.

## Required Output

```json
{
  "classifications": [
    {
      "behavior": "string",
      "status": "Covered | Missing | Weak | Failed | Suspicious",
      "suggestedTypes": ["Unit"],
      "risk": "Low | Medium | High | Critical",
      "explanation": "string"
    }
  ]
}
```

Return at least one classification when evidence is sparse, but mark uncertainty in `explanation`.
