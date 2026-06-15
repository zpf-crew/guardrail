# Unit Test Workbench Flow

Guardrail now supports a dedicated Unit Test path in the Generate / Improve Tests workbench.

The UI stays the same six-step workflow:

1. Intent
2. Isolation
3. Plan
4. Generate
5. Run
6. Review & Apply

The backend chooses the implementation by the selected primary test type. When the user selects `Unit`, the workbench routes jobs through `UnitAdapter`. When the user selects `UI / Browser`, the existing `UiBrowserAdapter` remains unchanged.

## High-Level Architecture

```text
GenerateTestsPage
  -> useWorkbench
  -> /api/workbench/:sessionId/<step>/jobs
  -> WorkbenchService
  -> adapter selected from intent.testTypes[0]
  -> UnitAdapter or UiBrowserAdapter
  -> SSE progress/result events back to the UI
```

`UnitAdapter` is skill-driven. It uses Unit-specific skill contracts so unit behavior does not inherit UI/browser assumptions.

## Unit Skills

The Unit flow uses these skill contracts under `guardrail-skills/`:

| Step | Skill | Model profile | Purpose |
| --- | --- | --- | --- |
| Isolation | `test-isolation-unit` | `thinker` | Classify function/module-level gaps, edge cases, validation branches, and suspicious or weak unit coverage. |
| Plan | `test-plan-unit` | `thinker` | Ask only product/behavior questions needed before encoding unit assertions. |
| Generate | `test-generate-unit` | `coder` | Produce staged unit test changes with review diff and complete file `content`. |
| Run | `test-run-unit` | `coder` | Produce structured guidance for how the generated unit test should be run. |
| Review | `test-review-unit` | `thinker` | Summarize generated unit tests, command output, failures, and remaining risk. |

The model does not execute commands or write files. It returns JSON that is validated by backend schemas.

## Step Details

### 1. Intent

**Input**

- User prompt
- Selected feature
- Selected test type: `Unit`
- Selected sources such as Codebase, specs, QC cases, existing tests

**Output**

- A workbench session with `intent.testTypes[0] === "Unit"`

No LLM call happens in this step.

### 2. Isolation

**Backend work**

- Loads repository context from the cloned repo.
- Ranks related source files, existing test files, spec docs, QC cases, and source snippets.
- Calls `test-isolation-unit` with schema `IsolationClassifications`.
- Builds the full `IsolationResult` deterministically from model classifications plus scan evidence.

**Output**

- Target feature
- Related source files
- Existing test files
- Spec docs
- QC cases
- Behavior classifications with statuses such as `Missing`, `Weak`, or `Suspicious`

### 3. Plan

**Backend work**

- Calls `test-plan-unit` with isolation and repository evidence.
- The skill returns only questions that require product clarification.
- Backend builds the plan shell deterministically.
- Unit plan files are normalized to JS/TS test paths such as `guardrail-tests/unit/<feature>.test.ts` when existing test paths are not available.

**Output**

- Proposed actions
- Files likely to change
- Risk assessment
- Optional product behavior questions

### 4. Generate

**Backend work**

- Calls `test-generate-unit`.
- The model returns `GenerationChanges`.
- Each unit `GeneratedChange` should include:
  - `testType: "Unit"`
  - `diff`: review-friendly preview
  - `content`: complete generated test file content
- Backend normalizes the output and fills fallback content if the model is unavailable.

**Output**

```ts
interface GeneratedChange {
  id: string;
  action: 'Add' | 'Update' | 'Delete';
  testType: 'Unit';
  title: string;
  file: string;
  feature: string;
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  reason: string;
  diff: DiffLine[];
  content?: string;
  status: 'staged' | 'applied' | 'reverted';
}
```

At this point, no file is written to the real repository.

### 5. Run

The Unit run is isolated from the real repo.

**Backend work**

1. Creates a detached temporary git worktree.
2. Symlinks `node_modules` when available.
3. Writes generated unit test content into the temp worktree.
4. Resolves the nearest JS/TS package test command.
5. Calls `test-run-unit` for structured run guidance.
6. Runs the focused generated test command.
7. Falls back to the full test command only when the runner rejects file arguments.
8. Cleans up the temp worktree in `finally`.

**Command examples**

```text
pnpm test -- src/foo/foo.test.ts
pnpm --dir backend test -- src/foo/foo.test.ts
npm --prefix backend test -- src/foo/foo.test.ts
yarn --cwd backend test -- src/foo/foo.test.ts
```

**Output**

- `run.unit.command`
- `run.unit.outcome`
- `run.unit.passed`
- `run.unit.failed`
- `run.matrix[]` rows for generated unit tests
- `run.attention` if a generated test failed or was flaky

`run.ui` and `run.mobile` are returned as `Skipped` for Unit runs.

### 6. Review & Apply

**Review**

- Calls `test-review-unit`.
- Produces a reviewer-facing recommendation based on generated changes and actual run output.
- Does not mention screenshots or browser evidence.

**Apply**

Apply is now a backend operation:

```http
POST /api/workbench/:sessionId/apply
```

Apply requires:

- session belongs to the authenticated user
- generation exists
- run exists
- no failed or flaky rows unless explicitly allowed by backend caller

When valid, backend materializes generated changes into the real cloned repository and marks changes as `applied`.

## Safety Model

- LLMs classify, plan, generate, and review.
- Backend validates every structured model response.
- Backend, not the model, decides file paths are inside the repo.
- Backend, not the model, executes commands.
- Generated unit tests run in a temp worktree before Apply.
- The real repo is changed only by the Apply endpoint.

## Current Scope

V1 is JS/TS-first:

- npm
- pnpm
- yarn
- Jest/Vitest/node:test style repositories when exposed through `scripts.test`

Other languages and deeper coverage delta parsing can be added later with new adapters or command resolvers.
