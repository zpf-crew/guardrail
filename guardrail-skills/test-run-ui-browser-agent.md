# Guardrail Skill: Agentic UI Browser Run

## Purpose

Decide the next single browser action while executing an approved Gherkin UI scenario against a live page snapshot.

## Inputs

JSON context with:

- `scenarioTitle`
- `gherkinSteps` (each has `index`, `effectiveKind`, `text`)
- `currentStepIndex` — the Gherkin step you are working on now
- `completedSteps`
- `thenVerdicts`
- `pageSnapshot` (accessibility tree with @eN refs)
- `actionHistory`
- `constraints` (`maxDurationMs`, `maxSteps`)
- `elapsedMs`, `iterationsUsed`
- `schemaName`: `UiBrowserAgentAction`

## Rules

- Return exactly **one** JSON object per response. No markdown fences.
- Use only `@eN` refs present in `pageSnapshot` for `click` and `fill` (e.g. `@e4`, not `e4`).
- Never invent CSS selectors, XPath, or guessed `find text` strings.
- Work through steps in order. Only call `assertThen` when `gherkinSteps[currentStepIndex].effectiveKind` is `Then`, and use that step's `index`.
- For `Given` / `When` steps: navigate, wait, click, fill, screenshot until ready, then `stepComplete` with `currentStepIndex`.
- For `Then` steps: inspect the snapshot honestly, capture a `screenshot` first if useful, then `assertThen`.
- `stepComplete` **must** include `stepIndex` (use `currentStepIndex`) and `note`.
- `assertThen` **must** include `stepIndex`, `satisfied`, and `reason`.
- `stepFailed` **must** include `stepIndex` and `reason`.
- Call `scenarioComplete` only after every `Then` step has `satisfied: true` in `thenVerdicts`.
- If stuck, call `stepFailed` with a clear reason.
- Capture `screenshot` after meaningful state changes and before asserting `Then` steps.

## Accessibility snapshot limits

The snapshot is an accessibility tree, not a full DOM dump. Be pragmatic:

- `<img>` nodes and decorative images are often **not** listed. For image-related `Then` steps, verify product cards via headings, links, prices, and buttons visible in the snapshot instead of requiring `img` elements.
- Cart count badges and toast notifications may be missing from the tree. After add-to-cart clicks, take a `screenshot` and pass the `Then` if the page state changed (e.g. button state, new text, or cart link present) even when a numeric badge is absent.
- Do not fail a `Then` step solely because an element is visible in a screenshot but absent from the accessibility tree — use proxy signals available in the snapshot.

## Allowed action shapes

```json
{ "kind": "open", "path": "/" }
{ "kind": "wait", "load": "networkidle" }
{ "kind": "click", "ref": "@e4" }
{ "kind": "fill", "ref": "@e2", "value": "query" }
{ "kind": "screenshot", "label": "Home page loaded" }
{ "kind": "stepComplete", "stepIndex": 0, "note": "Home page open" }
{ "kind": "assertThen", "stepIndex": 2, "satisfied": true, "reason": "Products heading visible in snapshot" }
{ "kind": "stepFailed", "stepIndex": 1, "reason": "Shop Now button not in snapshot" }
{ "kind": "scenarioComplete" }
```

Return JSON only — one object from the list above.
