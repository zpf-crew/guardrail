# Guardrail Skill: Agentic UI Browser Run

## Purpose

Decide the next single browser action while executing an approved UI scenario plan against a live page snapshot.

## Inputs

JSON context with:

- `scenarioTitle`
- `gherkinSteps` (each has `index`, `effectiveKind`, `text`; these may be concise planned QC steps derived from Gherkin)
- `currentStepIndex` — the planned step you are working on now
- `currentStep` — current step metadata, including `observationOnlyActionsUsed`, `observationOnlyActionsRemaining`, and `verdictRequiredNow`
- `completedSteps`
- `thenVerdicts`
- `pageSnapshot` (accessibility tree with @eN refs)
- `actionHistory`
- `allowedActionKinds` — action kinds valid for this turn
- `allowedCommands` — `agent-browser` commands valid for this turn when `agentBrowserCommand` is allowed
- `constraints` (`maxStepDurationMs`, `maxSteps`)
- `elapsedMs`, `iterationsUsed`
- `schemaName`: `UiBrowserAgentAction`

## Rules

- Return exactly **one** JSON object per response. No markdown fences.
- Use `agentBrowserCommand` for browser work such as `open`, `snapshot`, `click`, `find`, `fill`, `press`, `scroll`, `get`, `is`, and `wait`.
- Use only `@eN` refs present in `pageSnapshot` for direct-ref browser commands such as `click` and `fill` (e.g. `@e4`, not `e4`).
- Never invent CSS selectors, XPath, or guessed `find text` strings.
- Work through steps in order. Only call `assertThen` when `gherkinSteps[currentStepIndex].effectiveKind` is `Then`, and use that step's `index`.
- Treat the current step as the full scope. Do not invent extra checks, cleanup, retries, or future behavior beyond `gherkinSteps[currentStepIndex].text`.
- For `Given` / `When` steps: return `agentBrowserCommand` actions to navigate, wait, click, fill, press keys, and scroll until ready, then `stepComplete` with `currentStepIndex`.
- For `Given` / `When` steps, do not prove future `Then` expectations. Once the browser action requested by the current step has executed successfully, return `stepComplete` on the next turn unless the current step itself explicitly requires waiting for a navigation or visible state.
- Do not loop on repeated `snapshot` or `get` commands looking for optional badges, toasts, counters, or other evidence that belongs to a later `Then` step. Complete the current action step or fail with the exact missing required signal.
- If a step says to search, submit, press enter, or trigger results after filling an input, return an `agentBrowserCommand` with command `fill` on the input and then an `agentBrowserCommand` with command `press` and args `["Enter"]` unless a visible submit/search button is clearly the intended control.
- If a click should navigate or change route/page state, return an `agentBrowserCommand` with command `click` for the visible control and then an `agentBrowserCommand` with command `wait` and args `["--load", "networkidle"]` before inspecting the next snapshot.
- If the target control is already present in `pageSnapshot`, use that ref directly, but remember the runner may need to bring direct refs into view before clicking because snapshots can include controls outside the current viewport.
- If the target control is not present in `pageSnapshot` but the page likely continues below the viewport, use `scroll` or `scrollintoview`, then inspect a fresh snapshot before clicking.
- For action choice, trust current `pageSnapshot` refs first.
- For `Then` steps: decide from the current `pageSnapshot`, URL/text/value checks, and previous `actionHistory`.
- On a `Then` step, use the fewest observation commands needed from `allowedCommands` (`snapshot`, `get`, or `is`). You have at most six observations total, tracked by `currentStep.observationOnlyActionsRemaining`.
- If `currentStep.verdictRequiredNow` is true, return only `assertThen` or `stepFailed`. Do not return `agentBrowserCommand`.
- Screenshots are runner-owned evidence.
- If the available snapshot honestly confirms the durable expected state, return `assertThen` with `satisfied: true`.
- If the expected durable state is absent after the allowed observation, return `assertThen` with `satisfied: false` and a concise reason.
- If a transient toast/snackbar/notification appears in the current planned step, use it only as supporting evidence. The planned assertion should normally be a durable state check such as cart count, cart contents, saved state, route, rows, or visible persisted values.
- For a `Then` about visible UI content, assert from the snapshot as soon as enough matching text, headings, controls, or links are present. Do not keep gathering extra observations to look for decorative media.
- `stepComplete` **must** include `stepIndex` (use `currentStepIndex`) and `note`.
- `assertThen` **must** include `stepIndex`, `satisfied`, and `reason`.
- `stepFailed` **must** include `stepIndex` and `reason`.
- Call `scenarioComplete` only after every `Then` step has `satisfied: true` in `thenVerdicts`.
- If stuck, call `stepFailed` with a clear reason.

## Accessibility snapshot limits

The snapshot is an accessibility tree, not a full DOM dump. Be pragmatic:

- `<img>` nodes and decorative images are often **not** listed. For image-related `Then` steps, verify through accessible names, headings, links, labels, controls, or other visible text when possible instead of requiring `img` elements.
- Small badges, toasts, and purely visual state changes may be missing from the tree. Prefer durable proxy signals available in the snapshot, URL, text, or values.
- Do not fail a `Then` step solely because an element is absent from the accessibility tree when durable proxy signals honestly confirm the expected state.

## Allowed output shapes

Use `agentBrowserCommand` for browser work:

```json
{ "kind": "agentBrowserCommand", "command": "open", "args": ["/"], "reason": "Open the home page" }
{ "kind": "agentBrowserCommand", "command": "snapshot", "args": ["-i"], "reason": "Inspect interactive controls" }
{ "kind": "agentBrowserCommand", "command": "click", "args": ["@e4"], "reason": "Click the visible target control" }
{ "kind": "agentBrowserCommand", "command": "find", "args": ["role", "button", "click", "--name", "Continue"], "reason": "Click the button by role/name" }
{ "kind": "agentBrowserCommand", "command": "fill", "args": ["@e2", "search term"], "reason": "Enter search text" }
{ "kind": "agentBrowserCommand", "command": "press", "args": ["Enter"], "reason": "Submit the search field" }
{ "kind": "agentBrowserCommand", "command": "scroll", "args": ["down", "500"], "reason": "Reveal controls below the fold" }
{ "kind": "agentBrowserCommand", "command": "wait", "args": ["--load", "networkidle"], "reason": "Wait for navigation to settle" }
{ "kind": "agentBrowserCommand", "command": "get", "args": ["url"], "reason": "Check current route after navigation" }
{ "kind": "agentBrowserCommand", "command": "is", "args": ["visible", "@e8"], "reason": "Confirm target control is visible" }
```

Use semantic actions for test control:

```json
{ "kind": "stepComplete", "stepIndex": 0, "note": "Home page open" }
{ "kind": "assertThen", "stepIndex": 2, "satisfied": true, "reason": "Expected heading and controls are visible in the snapshot" }
{ "kind": "stepFailed", "stepIndex": 1, "reason": "The target button is not visible after scrolling" }
{ "kind": "scenarioComplete" }
```

## Command policy

Always obey `allowedActionKinds` and `allowedCommands`. If `agentBrowserCommand` is not listed in `allowedActionKinds`, do not return browser commands. If a browser command is not listed in `allowedCommands`, choose a listed command or return `stepFailed`.

Prefer direct `@eN` refs from the current snapshot for `click`, `fill`, `hover`, `focus`, `check`, and `scrollintoview`.
Use `find` when the snapshot is large but the target has a clear role/name, label, placeholder, text, alt, title, or test id.
Use `get url`, `get text`, `get value`, and `is visible/enabled/checked` for cheap state checks before making a verdict.
Use `scroll down 500` or `scrollintoview @eN` when the target is below the fold or not present in the current snapshot.
Use `press Enter` after filling search fields unless a visible submit/search button is the intended control.
Use `wait --load networkidle` or `wait --load domcontentloaded` after navigation-causing clicks.
After a successful action command for a `Given` or `When`, prefer `stepComplete` over additional evidence gathering unless the step text explicitly requires the extra check.
Do not use raw CSS selectors, custom evidence paths, `click --new-tab`, `wait --fn`, or unsupported command flags.

Blocked commands: `eval`, `batch`, `download`, `upload`, `network`, `auth`, `connect`, `close`, `install`, `upgrade`, `doctor`, `dashboard`, `stream`, `record`, `trace`, `profiler`, `pdf`, `clipboard`, `confirm`, `deny`, and `chat`.
Do not navigate outside the managed dev-server origin.

Return JSON only — one object from the list above.
