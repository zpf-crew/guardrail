# Workbench Evidence Streaming Design

Date: 2026-06-13

## Goal

Show UI Browser test evidence while the Run step is executing, then keep the same evidence visible in Review. A user should see progress messages and screenshot evidence without leaving the Tests page.

## Current Gap

The backend can emit `progress`, `screenshot`, `artifact`, `result`, and `error` events over SSE. The frontend currently waits for the final job result and does not keep intermediate events in state. Screenshot evidence also points to local agent-browser output, which is not safe for the browser to display directly.

## Selected UX

Use the approved **Run + Review evidence panel** layout.

Step 5, Run:

- Show a live progress log for the active UI Browser job.
- Show screenshot thumbnails as soon as screenshot events arrive.
- Keep the test result table below the live evidence area.
- If the run is still active, show the latest screenshot and running status.

Step 6, Review:

- Show the final evidence artifacts from the Run step.
- Include screenshot thumbnails and concise artifact labels.
- Keep review summary, changed files, and remaining risk visible.

## Backend Design

Use served artifact URLs instead of raw local file paths.

Add a workbench artifact service with one responsibility: convert local evidence files into browser-addressable evidence artifacts.

Responsibilities:

- Accept a local artifact path from the UI Browser runner.
- Copy the file into a controlled workbench artifact directory.
- Return an `Evidence` object with a stable API URL.
- Avoid exposing arbitrary filesystem paths.

Storage path:

```text
backend/.artifacts/workbench/:sessionId/:jobId/:artifactId.png
```

Read route:

```text
GET /api/workbench/:sessionId/artifacts/:artifactId
```

The route should:

- Validate that the artifact belongs to the session.
- Serve only files registered by the artifact service.
- Return 404 for missing or unknown artifacts.
- Include browser-safe headers for image rendering.

The UI Browser adapter should keep emitting `screenshot` events, but the event should contain the served artifact URL in `artifact.href`.

## Frontend Design

Extend the workbench hook to preserve job events.

State shape:

- `runEvents`: ordered job events for the current run job.
- `runProgress`: progress/thinking/error events derived from `runEvents`.
- `runEvidence`: artifact and screenshot events derived from `runEvents`.

`useWorkbench.runTests()` should call:

```ts
runSession(session.id, event => recordRunEvent(event))
```

The hook should clear previous run events before a new run starts, then append each SSE event as it arrives. The final `run` result still updates the session as today.

`RunStep` receives progress and evidence props and renders:

- progress log during active run
- screenshot thumbnails as soon as available
- final evidence section after completion
- existing test matrix table

`ReviewStep` receives the same evidence list and renders it in an “Evidence from run” section.

## Error Handling

Artifact copy failure should not fail the test run. The backend should emit a progress warning and fall back to a metadata-only evidence item if possible.

Screenshot route failures should render a broken-evidence state in the UI with the artifact label. The UI should not hide the rest of the run result.

If a run fails before screenshot capture, the progress log and error event are still shown. Review should show that no screenshot evidence was captured.

If the SSE stream disconnects, existing behavior can surface the job failure, but any events already received should remain visible.

## Testing

Backend:

- Unit test artifact registration/copy behavior.
- Route test artifact serving and 404 behavior.
- Route or adapter test that screenshot SSE events contain browser-safe URLs.
- Existing job route tests should continue passing.

Frontend:

- Typecheck the new event/evidence props and state.
- If a frontend test harness is later added, cover `RunStep` rendering for:
  - running with progress only
  - running with screenshot evidence
  - complete with persisted evidence
  - broken screenshot URL state

Manual smoke:

- Start the local backend and frontend.
- Run an onboarding UI Browser test from the Tests page.
- Confirm progress messages appear during Run.
- Confirm screenshot thumbnail appears during Run.
- Confirm the same screenshot appears in Review.

## Out of Scope

- Long-term artifact persistence across server restarts.
- Cloud object storage or signed URLs.
- Video, trace viewer, and visual diff rendering beyond listing artifacts.
- Applying generated test files to disk.
