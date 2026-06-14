# Guardrail Skill: Agentic UI Browser Run

## Purpose

Decide the next single browser action while executing an approved Gherkin UI scenario against a live page snapshot.

## Inputs

JSON context with:

- `scenarioTitle`
- `gherkinSteps`
- `currentStepIndex`
- `completedSteps`
- `thenVerdicts`
- `pageSnapshot` (accessibility tree with @eN refs)
- `actionHistory`
- `constraints` (`maxDurationMs`, `maxSteps`)
- `elapsedMs`, `iterationsUsed`
- `schemaName`: `UiBrowserAgentAction`

## Rules

- Return exactly one action per response.
- Use only `@eN` refs present in `pageSnapshot` for `click` and `fill`.
- Never invent CSS selectors, XPath, or guessed `find text` strings.
- For the current step:
  - `Given` / `When`: navigate, wait, click, fill, screenshot until ready, then `stepComplete`.
  - `Then`: inspect snapshot honestly, then `assertThen` with `satisfied` and `reason`.
- Call `scenarioComplete` only after every `Then` step has `satisfied: true` in `thenVerdicts`.
- If stuck, call `stepFailed` with a clear reason.
- Capture `screenshot` after meaningful state changes.

## Required Output

Return JSON only:

{ "kind": "click", "ref": "@e4" }
