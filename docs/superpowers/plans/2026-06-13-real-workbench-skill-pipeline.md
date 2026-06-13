# Real Workbench Skill Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded UI Browser workbench behavior with a repository-grounded pipeline driven by editable markdown skill contracts, validated model outputs, and real `agent-browser` evidence.

**Architecture:** Keep the current WorkbenchService, job queue, SSE event stream, and artifact store. Replace the static local repository context and deterministic UI Browser adapter payloads with a scanner, skill loader, structured model runner, validators, and a generated-scenario UI Browser runner.

**Tech Stack:** TypeScript, Node test runner, Fastify, zod, `agent-browser`, existing OpenAI-compatible `ModelConnect`.

---

## File Structure

Create:

- `guardrail-skills/test-isolation-files.md` - product-owned isolation instruction contract.
- `guardrail-skills/test-plan.md` - product-owned planning instruction contract.
- `guardrail-skills/test-generate-ui-browser.md` - product-owned UI Browser generation contract.
- `guardrail-skills/test-run-ui-browser.md` - product-owned browser run planning contract.
- `guardrail-skills/test-review.md` - product-owned review summary contract.
- `backend/src/modules/workbench/skills/skill-contract-loader.ts` - loads markdown skills from the repo root.
- `backend/src/modules/workbench/skills/skill-contract-loader.test.ts` - loader coverage.
- `backend/src/modules/workbench/model/structured-model-runner.ts` - calls thinker/coder with skills and validates JSON output.
- `backend/src/modules/workbench/model/structured-model-runner.test.ts` - JSON parse and validation coverage.
- `backend/src/modules/workbench/validation/workbench-validators.ts` - zod schemas for workbench step outputs.
- `backend/src/modules/workbench/validation/workbench-validators.test.ts` - validator coverage.
- `backend/src/modules/workbench/repositories/repository-scanner.ts` - scans selected repo files and snippets.
- `backend/src/modules/workbench/repositories/repository-scanner.test.ts` - scanner coverage against the local repo.
- `backend/src/modules/workbench/adapters/ui-browser/ui-browser-scenario.ts` - extracts generated scenario text and maps it to safe browser actions.
- `backend/src/modules/workbench/adapters/ui-browser/ui-browser-scenario.test.ts` - scenario mapping tests.

Modify:

- `backend/src/modules/workbench/repositories/repository-context-provider.ts` - expand source snippet shape and route metadata.
- `backend/src/modules/workbench/repositories/local-guardrail-repository-provider.ts` - use `RepositoryScanner` instead of static file arrays.
- `backend/src/modules/workbench/adapters/test-type-adapter.ts` - pass skill/model helpers to adapters.
- `backend/src/modules/workbench/workbench.service.ts` - construct loader/model runner dependencies for adapter input.
- `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.ts` - replace hardcoded analyze/plan/generate/review with skill-driven structured outputs.
- `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.ts` - execute generated scenario action plans and capture multiple checkpoint screenshots.
- `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.test.ts` - replace fallback assertions with model-driven assertions.
- `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.test.ts` - prove generated scenario actions drive commands and screenshots.
- `backend/src/modules/workbench/workbench.routes.test.ts` - adjust end-to-end fake model setup so all six steps still pass.

Do not commit `.superpowers/`.

---

### Task 1: Add Markdown Skill Contracts

**Files:**
- Create: `guardrail-skills/test-isolation-files.md`
- Create: `guardrail-skills/test-plan.md`
- Create: `guardrail-skills/test-generate-ui-browser.md`
- Create: `guardrail-skills/test-run-ui-browser.md`
- Create: `guardrail-skills/test-review.md`

- [ ] **Step 1: Create the skill directory and markdown files**

Use `apply_patch` to add the files. The exact content should be:

```markdown
# Guardrail Skill: Test Isolation Files

## Purpose

Identify the source files, existing tests, specs, QC cases, user journeys, and test gaps relevant to a user's test-improvement intent.

## Inputs

The backend provides JSON with:

- `intent`: prompt, selected feature, requested test types, and selected source contexts.
- `repository`: repo metadata, frontend route hints, ranked files, seeded or discovered QC cases, and bounded source snippets.
- `schemaName`: `IsolationResult`.

## Rules

- Use repository evidence first.
- Do not invent files, coverage, failures, or existing tests.
- If evidence is missing, state the uncertainty in `classifications[].explanation`.
- Prefer behavior-level classifications over implementation details.
- For UI Browser requests, include browser-visible user journeys when the repository context supports them.
- Return JSON only. Do not wrap JSON in markdown fences.

## Required Output

Return an object matching `IsolationResult` from `backend/src/modules/workbench/workbench.types.ts`.
```

```markdown
# Guardrail Skill: Test Plan

## Purpose

Turn an approved isolation result into a reviewable test-improvement plan.

## Inputs

The backend provides JSON with:

- `intent`
- `isolation`
- `repository`
- `schemaName`: `TestPlan`

## Rules

- Every proposed action must map to an isolated behavior or gap.
- Mark `browserAutomationRequired` true when UI Browser tests are planned.
- Set `productionCodeChanges` to `none` unless the evidence proves production code must change.
- Keep files reviewable and scoped to test artifacts.
- Ask questions only when a missing product behavior would make the test unsafe to generate.
- Return JSON only.

## Required Output

Return an object matching `TestPlan`.
```

```markdown
# Guardrail Skill: Generate UI Browser Test

## Purpose

Generate staged, human-readable UI Browser test artifacts from a validated Guardrail plan.

## Inputs

The backend provides JSON with:

- `intent`
- `isolation`
- `plan`
- `repository`
- `approval`
- `schemaName`: `GenerationResult`

## Rules

- Generate scenarios from the plan and repository snippets.
- Do not write production code.
- Use Gherkin-style language when it improves reviewer readability.
- Include enough scenario detail for the runner to map steps to browser actions.
- If approval cancels or skips UI Browser tests, return an empty `changes` array with a clear timeline and before/after summary.
- Return JSON only.

## Required Output

Return an object matching `GenerationResult`.
```

```markdown
# Guardrail Skill: Run UI Browser Test

## Purpose

Convert generated UI Browser scenarios into a bounded browser run plan.

## Inputs

The backend provides JSON with:

- `intent`
- `generation`
- `repository`
- `availableActions`
- `schemaName`: `UiBrowserRunPlan`

## Rules

- Use only supported browser actions.
- Prefer role/name selectors and visible UI text.
- Add screenshot checkpoints after meaningful user-visible state changes.
- Do not claim success for unmapped steps.
- Return JSON only.

## Required Output

Return:

{
  "scenarioTitle": "string",
  "actions": [
    { "kind": "open", "path": "/onboarding" },
    { "kind": "waitForLoad", "state": "networkidle" },
    { "kind": "screenshot", "label": "Onboarding page loaded" },
    { "kind": "click", "role": "button", "name": "Continue" },
    { "kind": "screenshot", "label": "Progress visible" },
    { "kind": "assertText", "text": "string" }
  ]
}
```

```markdown
# Guardrail Skill: Test Review

## Purpose

Summarize generated test artifacts, real run evidence, and remaining risk for reviewer decision-making.

## Inputs

The backend provides JSON with:

- `intent`
- `generation`
- `run`
- `repository`
- `schemaName`: `ReviewSummary`

## Rules

- Base the recommendation on actual generated changes and run results.
- Mention screenshot evidence when present.
- Do not claim coverage improvements unless coverage data exists.
- Preserve unresolved run failures as remaining risk.
- Return JSON only.

## Required Output

Return an object matching `ReviewSummary`.
```

- [ ] **Step 2: Commit the skills**

Run:

```bash
rtk git add guardrail-skills
rtk git commit -m "feat: add guardrail workbench skill contracts"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 2: Add Runtime Validators

**Files:**
- Create: `backend/src/modules/workbench/validation/workbench-validators.ts`
- Create: `backend/src/modules/workbench/validation/workbench-validators.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `backend/src/modules/workbench/validation/workbench-validators.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkbenchStepResult, validateUiBrowserRunPlan } from './workbench-validators.js';

test('validates isolation result shape', () => {
  const result = validateWorkbenchStepResult('IsolationResult', {
    target: { feature: 'Onboarding', repo: { name: 'guardrail', path: '/repo', branch: 'main' } },
    sourceFiles: [{ path: 'frontend/src/pages/OnboardingPage.tsx', kind: 'source' }],
    existingTestFiles: [],
    specDocs: [],
    qcCases: [],
    currentCoverage: { line: 0, branch: 0 },
    currentStatus: { failed: 0, suspicious: 0, missing: 1 },
    userJourneys: ['Complete onboarding'],
    classifications: [{
      behavior: 'Complete onboarding',
      status: 'Missing',
      suggestedTypes: ['UI / Browser'],
      risk: 'High',
      explanation: 'No UI Browser test was found in repository context.',
    }],
  });

  assert.equal(result.target.feature, 'Onboarding');
});

test('rejects invalid generation result shape', () => {
  assert.throws(
    () => validateWorkbenchStepResult('GenerationResult', { changes: 'not an array' }),
    /GenerationResult validation failed/,
  );
});

test('validates ui browser run plan', () => {
  const result = validateUiBrowserRunPlan({
    scenarioTitle: 'Complete onboarding',
    actions: [
      { kind: 'open', path: '/onboarding' },
      { kind: 'waitForLoad', state: 'networkidle' },
      { kind: 'screenshot', label: 'Onboarding loaded' },
      { kind: 'click', role: 'button', name: 'Continue' },
      { kind: 'assertText', text: 'Scan' },
    ],
  });

  assert.equal(result.actions.length, 5);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
rtk pnpm --dir backend test -- workbench-validators.test.ts
```

Expected: FAIL because `workbench-validators.ts` does not exist.

- [ ] **Step 3: Implement validators**

Create `backend/src/modules/workbench/validation/workbench-validators.ts` with zod schemas covering existing workbench schema strings and the new UI Browser run plan:

```ts
import { z } from 'zod';

const testTypeSchema = z.enum([
  'Unit', 'Integration', 'E2E', 'Contract', 'Regression', 'Edge Case',
  'Security', 'UI / Browser', 'Visual Screenshot', 'Mobile',
]);
const riskSchema = z.enum(['Low', 'Medium', 'High', 'Critical']);
const repoSchema = z.object({
  name: z.string(),
  path: z.string(),
  branch: z.string(),
  commit: z.string().optional(),
});
const relatedFileSchema = z.object({
  path: z.string(),
  kind: z.enum(['source', 'test', 'spec', 'qc']),
  meta: z.string().optional(),
});
const qcCaseSchema = z.object({
  id: z.string(),
  feature: z.string(),
  scenario: z.string(),
  expectedResult: z.string(),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']),
  automationStatus: z.enum(['automated', 'missing', 'unknown']),
});
const isolationSchema = z.object({
  target: z.object({ feature: z.string(), repo: repoSchema }),
  sourceFiles: z.array(relatedFileSchema),
  existingTestFiles: z.array(relatedFileSchema),
  specDocs: z.array(relatedFileSchema),
  qcCases: z.array(qcCaseSchema),
  currentCoverage: z.object({ line: z.number(), branch: z.number() }),
  currentStatus: z.object({
    failed: z.number(),
    suspicious: z.number(),
    missing: z.number(),
    flaky: z.number().optional(),
  }),
  userJourneys: z.array(z.string()),
  classifications: z.array(z.object({
    behavior: z.string(),
    status: z.enum(['Covered', 'Missing', 'Weak', 'Failed', 'Suspicious']),
    suggestedTypes: z.array(testTypeSchema),
    risk: riskSchema,
    explanation: z.string(),
  })),
});
const planSchema = z.object({
  proposedActions: z.array(z.object({
    action: z.enum(['add', 'update', 'delete', 'run']),
    label: z.string(),
    count: z.number().nullable(),
  })),
  risk: z.object({
    productionCodeChanges: z.enum(['none', 'expected']),
    testDataChanges: z.boolean(),
    browserAutomationRequired: z.boolean(),
    mobileSimulatorRequired: z.enum(['required', 'optional', 'no']),
    externalApiMocking: z.enum(['required', 'optional', 'no']),
  }),
  filesToChange: z.array(z.string()),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    answerIndex: z.number().optional(),
  })),
});
const diffLineSchema = z.object({ kind: z.enum(['add', 'del', 'context', 'meta']), text: z.string() });
const generationSchema = z.object({
  timeline: z.array(z.object({ label: z.string(), status: z.enum(['pending', 'running', 'done']) })),
  changes: z.array(z.object({
    id: z.string(),
    action: z.enum(['Add', 'Update', 'Delete']),
    testType: testTypeSchema,
    title: z.string(),
    file: z.string(),
    feature: z.string(),
    risk: riskSchema,
    reason: z.string(),
    diff: z.array(diffLineSchema),
    status: z.enum(['staged', 'applied', 'reverted']),
  })),
  beforeAfter: z.object({ before: z.array(z.string()), after: z.array(z.string()) }),
});
const outcomeSchema = z.enum(['Passed', 'Failed', 'Flaky', 'Skipped', 'Needs approval']);
const evidenceSchema = z.object({
  kind: z.enum(['screenshot', 'video', 'trace', 'device-log', 'visual-diff']),
  label: z.string(),
  href: z.string().optional(),
});
const runSchema = z.object({
  unit: z.object({ command: z.string(), outcome: outcomeSchema, passed: z.number(), failed: z.number().optional(), durationMs: z.number(), suite: z.string() }),
  ui: z.object({ command: z.string(), browser: z.string(), outcome: outcomeSchema, passed: z.number(), durationMs: z.number(), evidence: z.array(evidenceSchema), visual: z.object({ matchPercent: z.number(), baseline: z.string() }).optional() }),
  mobile: z.object({ command: z.string(), devices: z.array(z.string()), network: z.string().optional(), outcome: outcomeSchema, passed: z.number(), flaky: z.number().optional(), durationMs: z.number(), evidence: z.array(evidenceSchema) }),
  coverage: z.array(z.object({ metric: z.enum(['Line coverage', 'Branch coverage', 'Function coverage', 'Changed-files']), before: z.number(), after: z.number() })),
  matrix: z.array(z.object({ title: z.string(), type: testTypeSchema, status: outcomeSchema, duration: z.string().nullable(), evidence: z.string().nullable(), file: z.string() })),
  attention: z.object({
    testTitle: z.string(),
    kind: z.enum(['failed', 'flaky']),
    reason: z.string(),
    likelyCause: z.string(),
    suggestedFix: z.string(),
    actions: z.array(z.enum(['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'])),
  }).optional(),
});
const reviewSchema = z.object({
  testsAdded: z.number(),
  testsUpdated: z.number(),
  testsDeleted: z.number(),
  testsPassing: z.string(),
  coverage: z.object({ lineDelta: z.number(), branchDelta: z.number() }),
  flakyTracked: z.number(),
  filesChanged: z.array(z.object({ path: z.string(), diffStat: z.string(), changeKind: z.enum(['add', 'update', 'delete']) })),
  remainingRisk: z.array(z.object({ label: z.string(), value: z.string(), sentiment: z.enum(['good', 'bad', 'neutral']) })),
  openQuestions: z.number(),
  recommendation: z.string(),
});

const runActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('open'), path: z.string() }),
  z.object({ kind: z.literal('waitForLoad'), state: z.enum(['load', 'domcontentloaded', 'networkidle']) }),
  z.object({ kind: z.literal('snapshot') }),
  z.object({ kind: z.literal('screenshot'), label: z.string() }),
  z.object({ kind: z.literal('click'), role: z.string(), name: z.string() }),
  z.object({ kind: z.literal('fill'), label: z.string(), value: z.string() }),
  z.object({ kind: z.literal('assertText'), text: z.string() }),
]);
const uiBrowserRunPlanSchema = z.object({
  scenarioTitle: z.string(),
  actions: z.array(runActionSchema).min(1),
});

const schemas = {
  IsolationResult: isolationSchema,
  TestPlan: planSchema,
  GenerationResult: generationSchema,
  TestRunResult: runSchema,
  ReviewSummary: reviewSchema,
} as const;

export type WorkbenchSchemaName = keyof typeof schemas;
export type UiBrowserRunPlan = z.infer<typeof uiBrowserRunPlanSchema>;

export function validateWorkbenchStepResult<TName extends WorkbenchSchemaName>(
  schemaName: TName,
  value: unknown,
): z.infer<(typeof schemas)[TName]> {
  const result = schemas[schemaName].safeParse(value);
  if (!result.success) {
    throw new Error(`${schemaName} validation failed: ${result.error.issues.map(issue => issue.path.join('.') || issue.message).join(', ')}`);
  }
  return result.data;
}

export function validateUiBrowserRunPlan(value: unknown): UiBrowserRunPlan {
  const result = uiBrowserRunPlanSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`UiBrowserRunPlan validation failed: ${result.error.issues.map(issue => issue.path.join('.') || issue.message).join(', ')}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run validators test**

Run:

```bash
rtk pnpm --dir backend test -- workbench-validators.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit validators**

Run:

```bash
rtk git add backend/src/modules/workbench/validation
rtk git commit -m "feat: validate workbench model outputs"
```

---

### Task 3: Add Skill Loader

**Files:**
- Create: `backend/src/modules/workbench/skills/skill-contract-loader.ts`
- Create: `backend/src/modules/workbench/skills/skill-contract-loader.test.ts`

- [ ] **Step 1: Write failing loader tests**

Create `backend/src/modules/workbench/skills/skill-contract-loader.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillContractLoader } from './skill-contract-loader.js';

test('loads markdown skill by name', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-skills-'));
  await writeFile(join(root, 'test-plan.md'), '# Plan Skill\n\nReturn JSON only.');
  const loader = new SkillContractLoader({ skillsDir: root });

  const skill = await loader.load('test-plan');

  assert.equal(skill.name, 'test-plan');
  assert.match(skill.content, /Return JSON only/);
});

test('rejects unsafe skill names', async () => {
  const loader = new SkillContractLoader({ skillsDir: '/tmp' });

  await assert.rejects(() => loader.load('../secret'), /Invalid skill name/);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
rtk pnpm --dir backend test -- skill-contract-loader.test.ts
```

Expected: FAIL because loader does not exist.

- [ ] **Step 3: Implement loader**

Create `backend/src/modules/workbench/skills/skill-contract-loader.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SkillContractName =
  | 'test-isolation-files'
  | 'test-plan'
  | 'test-generate-ui-browser'
  | 'test-run-ui-browser'
  | 'test-review';

export interface SkillContract {
  name: SkillContractName;
  content: string;
}

export class SkillContractLoader {
  readonly #skillsDir: string;

  constructor(options: { skillsDir: string }) {
    this.#skillsDir = options.skillsDir;
  }

  async load(name: SkillContractName): Promise<SkillContract> {
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error(`Invalid skill name: ${name}`);
    }

    const content = await readFile(join(this.#skillsDir, `${name}.md`), 'utf8').catch(error => {
      throw new Error(`Failed to load Guardrail skill ${name}: ${error instanceof Error ? error.message : String(error)}`);
    });

    return { name, content };
  }
}
```

- [ ] **Step 4: Run loader test**

Run:

```bash
rtk pnpm --dir backend test -- skill-contract-loader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit loader**

Run:

```bash
rtk git add backend/src/modules/workbench/skills
rtk git commit -m "feat: load workbench skill contracts"
```

---

### Task 4: Add Repository Scanner

**Files:**
- Modify: `backend/src/modules/workbench/repositories/repository-context-provider.ts`
- Create: `backend/src/modules/workbench/repositories/repository-scanner.ts`
- Create: `backend/src/modules/workbench/repositories/repository-scanner.test.ts`
- Modify: `backend/src/modules/workbench/repositories/local-guardrail-repository-provider.ts`

- [ ] **Step 1: Write scanner tests**

Create `backend/src/modules/workbench/repositories/repository-scanner.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryScanner } from './repository-scanner.js';

test('scanner finds onboarding files from local guardrail repo', async () => {
  const scanner = new RepositoryScanner({ rootDir: process.cwd() });

  const context = await scanner.scan({
    prompt: 'improve onboarding UI test',
    feature: null,
    testTypes: ['UI / Browser'],
  });

  assert.equal(context.repo.name, 'guardrail');
  assert.ok(context.relatedFiles.some(file => file.path === 'frontend/src/pages/OnboardingPage.tsx'));
  assert.ok(context.sourceSnippets.some(snippet => snippet.path === 'frontend/src/pages/OnboardingPage.tsx'));
  assert.equal(context.frontend.route, '/onboarding');
});
```

- [ ] **Step 2: Expand repository context type**

Modify `backend/src/modules/workbench/repositories/repository-context-provider.ts`:

```ts
import type { IntentInput, QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';

export interface SourceSnippet {
  path: string;
  startLine: number;
  endLine: number;
  summary: string;
  text: string;
}

export interface RepositoryContext {
  repo: RepoRef;
  frontend: {
    startCommand: string;
    healthUrl: string;
    url: string;
    route: '/onboarding';
  };
  relatedFiles: RelatedFile[];
  specDocs: RelatedFile[];
  qcCases: QCTestCase[];
  sourceSnippets: SourceSnippet[];
}

export interface RepositoryContextProvider {
  getContext(repoId: string, intent?: IntentInput): Promise<RepositoryContext>;
}
```

- [ ] **Step 3: Implement scanner**

Create `backend/src/modules/workbench/repositories/repository-scanner.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IntentInput, QCTestCase, RelatedFile, RepoRef, TestType } from '../workbench.types.js';
import type { RepositoryContext, SourceSnippet } from './repository-context-provider.js';

const execFileAsync = promisify(execFile);
const maxSnippetChars = 6000;
const sourceCandidates = [
  'frontend/src/pages/OnboardingPage.tsx',
  'frontend/src/data/onboardingMockData.ts',
  'frontend/src/pages/GenerateTestsPage.tsx',
  'frontend/src/data/workbench-api.ts',
];
const testCandidatePatterns = [
  'frontend/src/**/*.test.ts',
  'frontend/src/**/*.test.tsx',
  'backend/src/**/*.test.ts',
];

export class RepositoryScanner {
  readonly #rootDir: string;

  constructor(options: { rootDir: string }) {
    this.#rootDir = options.rootDir;
  }

  async scan(intent: Pick<IntentInput, 'prompt' | 'feature' | 'testTypes'>): Promise<RepositoryContext> {
    const repo = await this.#repoRef();
    const rankedSources = this.#rankSourceCandidates(intent);
    const sourceFiles = await this.#existingFiles(rankedSources, 'source');
    const existingTestFiles = await this.#findTests(intent);
    const sourceSnippets = await this.#snippets(sourceFiles.slice(0, 5));

    return {
      repo,
      frontend: {
        startCommand: 'pnpm --dir frontend dev --host 127.0.0.1',
        healthUrl: 'http://127.0.0.1:5173',
        url: 'http://127.0.0.1:5173/onboarding',
        route: '/onboarding',
      },
      relatedFiles: [...sourceFiles, ...existingTestFiles],
      specDocs: [],
      qcCases: this.#seededQcCases(),
      sourceSnippets,
    };
  }

  async #repoRef(): Promise<RepoRef> {
    const branch = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: this.#rootDir })
      .then(result => result.stdout.trim())
      .catch(() => 'local');
    const commit = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: this.#rootDir })
      .then(result => result.stdout.trim())
      .catch(() => undefined);
    return { name: 'guardrail', path: this.#rootDir, branch, commit };
  }

  #rankSourceCandidates(intent: Pick<IntentInput, 'prompt' | 'feature' | 'testTypes'>): string[] {
    const terms = `${intent.prompt} ${intent.feature ?? ''}`.toLowerCase();
    if (terms.includes('onboarding')) return sourceCandidates;
    return sourceCandidates;
  }

  async #existingFiles(paths: string[], kind: RelatedFile['kind']): Promise<RelatedFile[]> {
    const files: RelatedFile[] = [];
    for (const path of paths) {
      const absolute = join(this.#rootDir, path);
      const exists = await readFile(absolute, 'utf8').then(() => true).catch(() => false);
      if (exists) files.push({ path, kind, meta: kind === 'source' ? 'Discovered from selected repository scan.' : undefined });
    }
    return files;
  }

  async #findTests(intent: Pick<IntentInput, 'prompt' | 'feature' | 'testTypes'>): Promise<RelatedFile[]> {
    const terms = `${intent.prompt} ${intent.feature ?? ''}`.toLowerCase();
    const rgArgs = ['--files', ...testCandidatePatterns];
    const output = await execFileAsync('rg', rgArgs, { cwd: this.#rootDir })
      .then(result => result.stdout)
      .catch(() => '');
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(path => terms.includes('onboarding') ? /onboarding|workbench|generate/i.test(path) : true)
      .slice(0, 8)
      .map(path => ({ path: relative(this.#rootDir, join(this.#rootDir, path)), kind: 'test' as const, meta: 'Discovered existing test candidate.' }));
  }

  async #snippets(files: RelatedFile[]): Promise<SourceSnippet[]> {
    const snippets: SourceSnippet[] = [];
    for (const file of files) {
      const text = await readFile(join(this.#rootDir, file.path), 'utf8');
      const lines = text.split('\n');
      const selected = lines.slice(0, 160).join('\n').slice(0, maxSnippetChars);
      snippets.push({
        path: file.path,
        startLine: 1,
        endLine: Math.min(lines.length, 160),
        summary: file.meta ?? 'Repository source snippet.',
        text: selected,
      });
    }
    return snippets;
  }

  #seededQcCases(): QCTestCase[] {
    return [{
      id: 'QC-ONB-001',
      feature: 'Onboarding',
      scenario: 'Complete onboarding with local repository and optional knowledge sources',
      expectedResult: 'The onboarding flow reaches repository scan progress or completion state.',
      priority: 'High',
      automationStatus: 'missing',
    }];
  }
}
```

- [ ] **Step 4: Wire local provider to scanner**

Replace `backend/src/modules/workbench/repositories/local-guardrail-repository-provider.ts` with:

```ts
import type { IntentInput } from '../workbench.types.js';
import type { RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';
import { RepositoryScanner } from './repository-scanner.js';

interface LocalGuardrailRepositoryProviderOptions {
  rootDir: string;
}

export class LocalGuardrailRepositoryProvider implements RepositoryContextProvider {
  readonly #scanner: RepositoryScanner;

  constructor(options: LocalGuardrailRepositoryProviderOptions) {
    this.#scanner = new RepositoryScanner({ rootDir: options.rootDir });
  }

  async getContext(_repoId: string, intent?: IntentInput): Promise<RepositoryContext> {
    return this.#scanner.scan(intent ?? {
      prompt: '',
      feature: null,
      testTypes: ['UI / Browser'],
      sources: ['Codebase'],
    });
  }
}
```

- [ ] **Step 5: Update service call**

In `backend/src/modules/workbench/workbench.service.ts`, change:

```ts
const repository = await this.repositoryProvider.getContext(currentSession.repo.name);
```

to:

```ts
const repository = await this.repositoryProvider.getContext(currentSession.repo.name, currentSession.intent);
```

- [ ] **Step 6: Run scanner tests**

Run:

```bash
rtk pnpm --dir backend test -- repository-scanner.test.ts local-guardrail-repository-provider.test.ts
```

Expected: PASS after updating any provider test expected branch/URL values to use scanner output.

- [ ] **Step 7: Commit scanner**

Run:

```bash
rtk git add backend/src/modules/workbench/repositories backend/src/modules/workbench/workbench.service.ts
rtk git commit -m "feat: scan selected repository context"
```

---

### Task 5: Add Structured Model Runner

**Files:**
- Create: `backend/src/modules/workbench/model/structured-model-runner.ts`
- Create: `backend/src/modules/workbench/model/structured-model-runner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/modules/workbench/model/structured-model-runner.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { StructuredModelRunner } from './structured-model-runner.js';

test('parses fenced json and validates output', async () => {
  const runner = new StructuredModelRunner({
    modelConnect: {
      getThinker: () => ({
        chat: async () => ({ content: '```json\n{"proposedActions":[],"risk":{"productionCodeChanges":"none","testDataChanges":false,"browserAutomationRequired":true,"mobileSimulatorRequired":"no","externalApiMocking":"no"},"filesToChange":[],"questions":[]}\n```' }),
      }),
      getCoder: () => ({ chat: async () => ({ content: '{}' }) }),
    } as never,
  });

  const result = await runner.runStep({
    profile: 'thinker',
    skill: { name: 'test-plan', content: '# Plan' },
    schemaName: 'TestPlan',
    context: { intent: { prompt: 'improve onboarding UI test' } },
    signal: new AbortController().signal,
  });

  assert.equal(result.risk.browserAutomationRequired, true);
});

test('fails clearly when model is unavailable', async () => {
  const runner = new StructuredModelRunner({ modelConnect: null });

  await assert.rejects(
    () => runner.runStep({
      profile: 'thinker',
      skill: { name: 'test-plan', content: '# Plan' },
      schemaName: 'TestPlan',
      context: {},
      signal: new AbortController().signal,
    }),
    /LLM is not configured/,
  );
});
```

- [ ] **Step 2: Implement model runner**

Create `backend/src/modules/workbench/model/structured-model-runner.ts`:

```ts
import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { ModelProfile } from '../../models/model.types.js';
import type { SkillContract } from '../skills/skill-contract-loader.js';
import { validateWorkbenchStepResult, type WorkbenchSchemaName } from '../validation/workbench-validators.js';

interface StructuredModelRunnerOptions {
  modelConnect: ModelConnect | null;
}

interface RunStepArgs {
  profile: ModelProfile;
  skill: SkillContract;
  schemaName: WorkbenchSchemaName;
  context: unknown;
  signal: AbortSignal;
}

export class StructuredModelRunner {
  readonly #modelConnect: ModelConnect | null;

  constructor(options: StructuredModelRunnerOptions) {
    this.#modelConnect = options.modelConnect;
  }

  async runStep(args: RunStepArgs) {
    if (!this.#modelConnect) {
      throw new Error(`LLM is not configured for ${args.skill.name}. Configure LLM_BASE_URL and LLM_API_KEY.`);
    }

    const client = this.#modelConnect.getClient(args.profile);
    const response = await client.chat([
      { role: 'system', content: args.skill.content },
      { role: 'user', content: JSON.stringify({ schemaName: args.schemaName, context: args.context }, null, 2) },
    ], { temperature: 0, maxTokens: 4000, signal: args.signal });

    const content = typeof response === 'string' ? response : response.content;
    const parsed = parseJsonObject(content);
    return validateWorkbenchStepResult(args.schemaName, parsed);
  }
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Model returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

- [ ] **Step 3: Align response type with actual ModelClient**

Open `backend/src/modules/model-connect/model-client.ts`. If `chat()` returns a raw string or a different object shape, adapt only the `const content = ...` line in `StructuredModelRunner`. Keep tests injected with the same return shape that production uses.

- [ ] **Step 4: Run model runner tests**

Run:

```bash
rtk pnpm --dir backend test -- structured-model-runner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit model runner**

Run:

```bash
rtk git add backend/src/modules/workbench/model
rtk git commit -m "feat: run structured workbench model steps"
```

---

### Task 6: Inject Skill and Model Helpers Into Adapter Input

**Files:**
- Modify: `backend/src/modules/workbench/adapters/test-type-adapter.ts`
- Modify: `backend/src/modules/workbench/workbench.service.ts`
- Modify: `backend/src/modules/workbench/workbench.routes.test.ts`

- [ ] **Step 1: Extend adapter input**

Modify `backend/src/modules/workbench/adapters/test-type-adapter.ts`:

```ts
import type { StructuredModelRunner } from '../model/structured-model-runner.js';
import type { SkillContractLoader } from '../skills/skill-contract-loader.js';
```

Add fields to `AdapterInput`:

```ts
  skills: SkillContractLoader;
  structuredModel: StructuredModelRunner;
```

- [ ] **Step 2: Construct helpers in service**

In `backend/src/modules/workbench/workbench.service.ts`, import:

```ts
import { join } from 'node:path';
import { SkillContractLoader } from './skills/skill-contract-loader.js';
import { StructuredModelRunner } from './model/structured-model-runner.js';
```

Inside the queued `run` callback, before `baseInput`, add:

```ts
const skills = new SkillContractLoader({ skillsDir: join(process.cwd(), '..', 'guardrail-skills') });
const structuredModel = new StructuredModelRunner({ modelConnect });
```

If `process.cwd()` for backend tests is already the repo root, use:

```ts
const skills = new SkillContractLoader({ skillsDir: join(process.cwd(), 'guardrail-skills') });
```

Pick the path that makes `rtk pnpm --dir backend test` pass from the repo root. Do not add environment-specific absolute paths.

Add to `baseInput`:

```ts
skills,
structuredModel,
```

- [ ] **Step 3: Update tests that build `AdapterInput`**

Every test helper that creates `AdapterInput` must provide fake `skills` and `structuredModel`. Use this helper pattern:

```ts
const skills = {
  load: async (name: string) => ({ name, content: `# ${name}` }),
} as AdapterInput['skills'];
const structuredModel = {
  runStep: async () => {
    throw new Error('structuredModel.runStep must be overridden by this test');
  },
} as unknown as AdapterInput['structuredModel'];
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
rtk pnpm --dir backend typecheck
```

Expected: PASS after all test helpers are updated.

- [ ] **Step 5: Commit dependency injection**

Run:

```bash
rtk git add backend/src/modules/workbench/adapters/test-type-adapter.ts backend/src/modules/workbench/workbench.service.ts backend/src/modules/workbench
rtk git commit -m "feat: inject workbench skill model helpers"
```

---

### Task 7: Replace UI Browser Adapter Step Outputs With Skill-Driven Results

**Files:**
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser.adapter.test.ts`

- [ ] **Step 1: Rewrite adapter tests to prove model output is used**

In `ui-browser.adapter.test.ts`, replace the fallback schema test with:

```ts
test('ui browser adapter uses structured model outputs for analyze plan generate review', async () => {
  const outputs = {
    IsolationResult: {
      target: { feature: 'Onboarding', repo: { name: 'guardrail', path: process.cwd(), branch: 'test' } },
      sourceFiles: [{ path: 'frontend/src/pages/OnboardingPage.tsx', kind: 'source' }],
      existingTestFiles: [],
      specDocs: [],
      qcCases: [],
      currentCoverage: { line: 0, branch: 0 },
      currentStatus: { failed: 0, suspicious: 0, missing: 1 },
      userJourneys: ['Complete onboarding with selected repository'],
      classifications: [{
        behavior: 'Complete onboarding with selected repository',
        status: 'Missing',
        suggestedTypes: ['UI / Browser'],
        risk: 'High',
        explanation: 'Model identified no UI Browser evidence in repo context.',
      }],
    },
    TestPlan: {
      proposedActions: [{ action: 'add', label: 'Add UI Browser onboarding scenario', count: 1 }],
      risk: { productionCodeChanges: 'none', testDataChanges: false, browserAutomationRequired: true, mobileSimulatorRequired: 'no', externalApiMocking: 'no' },
      filesToChange: ['guardrail-tests/ui/onboarding.feature'],
      questions: [],
    },
    GenerationResult: {
      timeline: [{ label: 'Generate onboarding scenario', status: 'done' }],
      changes: [{
        id: 'ui-browser-onboarding',
        action: 'Add',
        testType: 'UI / Browser',
        title: 'Complete onboarding with selected repository',
        file: 'guardrail-tests/ui/onboarding.feature',
        feature: 'Onboarding',
        risk: 'High',
        reason: 'Covers browser-visible onboarding behavior.',
        diff: [{ kind: 'add', text: 'Scenario: Complete onboarding with selected repository' }],
        status: 'staged',
      }],
      beforeAfter: { before: ['No UI Browser evidence.'], after: ['One scenario staged.'] },
    },
    ReviewSummary: {
      testsAdded: 1,
      testsUpdated: 0,
      testsDeleted: 0,
      testsPassing: '1/1',
      coverage: { lineDelta: 0, branchDelta: 0 },
      flakyTracked: 0,
      filesChanged: [{ path: 'guardrail-tests/ui/onboarding.feature', diffStat: '+1', changeKind: 'add' }],
      remainingRisk: [{ label: 'Persistence', value: 'Generated file is staged only.', sentiment: 'neutral' }],
      openQuestions: 0,
      recommendation: 'Review screenshot evidence before applying.',
    },
  };
  const seenSchemas: string[] = [];
  const input = await buildInput({
    structuredModel: {
      runStep: async ({ schemaName }: { schemaName: keyof typeof outputs }) => {
        seenSchemas.push(schemaName);
        return structuredClone(outputs[schemaName]);
      },
    } as never,
  });
  const adapter = new UiBrowserAdapter({ runner: { run: async () => ({ outcome: 'Passed', durationMs: 1000, evidence: [] }) } });

  const isolation = await adapter.analyze(input);
  const plan = await adapter.plan({ ...input, isolation });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });
  const run = await adapter.run({ ...input, generation });
  const review = await adapter.review({ ...input, generation, run });

  assert.deepEqual(seenSchemas, ['IsolationResult', 'TestPlan', 'GenerationResult', 'ReviewSummary']);
  assert.equal(isolation.sourceFiles[0]?.path, 'frontend/src/pages/OnboardingPage.tsx');
  assert.equal(plan.filesToChange[0], 'guardrail-tests/ui/onboarding.feature');
  assert.equal(generation.changes[0]?.title, 'Complete onboarding with selected repository');
  assert.equal(run.ui.outcome, 'Passed');
  assert.equal(review.recommendation, 'Review screenshot evidence before applying.');
});
```

Delete or rewrite tests that assert:

- fallback analyze output
- fallback generation text
- fallback screenshots when runner returns no evidence
- skipped fallback with explicit no-op runner

Keep tests for:

- approval skip/cancel behavior
- abort propagation
- runner failure attention
- screenshot evidence normalization

- [ ] **Step 2: Implement skill-driven adapter methods**

In `ui-browser.adapter.ts`:

- Remove `onboardingBehavior`, `fallbackFeatureText`, `buildAnalyzePrompt`, `buildGeneratePrompt`, `#tryThinker`, and `#tryCoder`.
- `analyze()` should:

```ts
const skill = await input.skills.load('test-isolation-files');
await input.emit({ type: 'progress', message: 'Scanning repository context for UI Browser gaps.', percent: 20 });
return input.structuredModel.runStep({
  profile: 'thinker',
  skill,
  schemaName: 'IsolationResult',
  context: { intent: input.session.intent, repository: input.repository },
  signal: input.signal,
});
```

- `plan()` should load `test-plan` and run `TestPlan`.
- `generate()` should preserve cancel/skip/unit-only no-op behavior, otherwise load `test-generate-ui-browser` and run `GenerationResult`.
- `review()` should load `test-review` and run `ReviewSummary`.
- `run()` still calls `#runUi`, but derives matrix title/file/count from `generation.changes`.

- [ ] **Step 3: Ensure no normal runtime hardcoded fallback remains**

Run:

```bash
rtk rg -n "fallback|onboardingBehavior|deterministic|hardcoded" backend/src/modules/workbench/adapters/ui-browser
```

Expected: no production fallback paths remain except test names or comments that explicitly reject fallback behavior.

- [ ] **Step 4: Run adapter tests**

Run:

```bash
rtk pnpm --dir backend test -- ui-browser.adapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit adapter rewrite**

Run:

```bash
rtk git add backend/src/modules/workbench/adapters/ui-browser
rtk git commit -m "feat: drive ui browser adapter from skills"
```

---

### Task 8: Execute Generated UI Browser Scenario Actions

**Files:**
- Create: `backend/src/modules/workbench/adapters/ui-browser/ui-browser-scenario.ts`
- Create: `backend/src/modules/workbench/adapters/ui-browser/ui-browser-scenario.test.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.ts`
- Modify: `backend/src/modules/workbench/adapters/ui-browser/ui-browser-runner.test.ts`

- [ ] **Step 1: Add scenario extraction tests**

Create `ui-browser-scenario.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarioTextFromGeneration, fallbackRunPlanFromScenario } from './ui-browser-scenario.js';
import type { GenerationResult } from '../../workbench.types.js';

test('extracts scenario text from generated diff', () => {
  const generation: GenerationResult = {
    timeline: [],
    changes: [{
      id: 'ui-browser-onboarding',
      action: 'Add',
      testType: 'UI / Browser',
      title: 'Complete onboarding',
      file: 'guardrail-tests/ui/onboarding.feature',
      feature: 'Onboarding',
      risk: 'High',
      reason: 'Needed coverage.',
      status: 'staged',
      diff: [
        { kind: 'add', text: 'Feature: Guardrail onboarding' },
        { kind: 'add', text: '  Scenario: Complete onboarding' },
        { kind: 'add', text: '    Given the user opens Guardrail onboarding' },
      ],
    }],
    beforeAfter: { before: [], after: [] },
  };

  assert.match(scenarioTextFromGeneration(generation), /Scenario: Complete onboarding/);
});

test('fallback run plan is derived from scenario text and includes multiple screenshots', () => {
  const plan = fallbackRunPlanFromScenario('Scenario: Complete onboarding\nWhen the user continues\nThen scan progress is visible');

  assert.equal(plan.actions.filter(action => action.kind === 'screenshot').length >= 2, true);
  assert.equal(plan.actions[0]?.kind, 'open');
});
```

- [ ] **Step 2: Implement scenario helpers**

Create `ui-browser-scenario.ts`:

```ts
import type { GenerationResult } from '../../workbench.types.js';
import type { UiBrowserRunPlan } from '../../validation/workbench-validators.js';

export function scenarioTextFromGeneration(generation: GenerationResult): string {
  return generation.changes
    .filter(change => change.testType === 'UI / Browser')
    .flatMap(change => change.diff.filter(line => line.kind === 'add' || line.kind === 'context').map(line => line.text))
    .join('\n')
    .trim();
}

export function fallbackRunPlanFromScenario(scenarioText: string): UiBrowserRunPlan {
  const wantsContinue = /\bcontinue\b/i.test(scenarioText);
  const wantsScan = /\bscan|progress|complete\b/i.test(scenarioText);
  return {
    scenarioTitle: titleFromScenario(scenarioText),
    actions: [
      { kind: 'open', path: '/onboarding' },
      { kind: 'waitForLoad', state: 'networkidle' },
      { kind: 'snapshot' },
      { kind: 'screenshot', label: 'Onboarding page loaded' },
      ...(wantsContinue ? [{ kind: 'click' as const, role: 'button', name: 'Continue' }] : []),
      { kind: 'waitForLoad', state: 'networkidle' },
      ...(wantsScan ? [{ kind: 'screenshot' as const, label: 'Onboarding progress evidence' }] : []),
    ],
  };
}

function titleFromScenario(text: string): string {
  const match = text.match(/Scenario:\s*(.+)/i);
  return match?.[1]?.trim() || 'Generated UI Browser scenario';
}
```

- [ ] **Step 3: Change runner interface**

Modify `UiBrowserRunnerRunArgs` in `ui-browser-runner.ts`:

```ts
import type { UiBrowserRunPlan } from '../../validation/workbench-validators.js';

export interface UiBrowserRunnerRunArgs {
  url: string;
  route: string;
  plan: UiBrowserRunPlan;
  signal: AbortSignal;
  onCommand?: (args: string[], index: number, total: number, label?: string) => void;
}
```

Replace static `commandSequence(url)` with:

```ts
interface RunnerCommand {
  args: string[];
  screenshotLabel?: string;
}

function commandSequence(baseUrl: string, route: string, plan: UiBrowserRunPlan): RunnerCommand[] {
  return plan.actions.map(action => {
    switch (action.kind) {
      case 'open':
        return { args: ['open', new URL(action.path, baseUrl).toString()] };
      case 'waitForLoad':
        return { args: ['wait', '--load', action.state] };
      case 'snapshot':
        return { args: ['snapshot', '-i'] };
      case 'screenshot':
        return { args: ['screenshot'], screenshotLabel: action.label };
      case 'click':
        return { args: ['find', 'role', action.role, 'click', '--name', action.name] };
      case 'fill':
        return { args: ['find', 'label', action.label, 'fill', action.value] };
      case 'assertText':
        return { args: ['find', 'text', action.text] };
    }
  });
}
```

Update screenshot evidence:

```ts
function evidenceFromScreenshot(stdout: string, label: string): Evidence {
  return screenshotEvidence(label, screenshotPathFromStdout(stdout));
}
```

- [ ] **Step 4: Update runner tests**

In `ui-browser-runner.test.ts`, pass:

```ts
plan: {
  scenarioTitle: 'Complete onboarding',
  actions: [
    { kind: 'open', path: '/onboarding' },
    { kind: 'waitForLoad', state: 'networkidle' },
    { kind: 'screenshot', label: 'Onboarding loaded' },
    { kind: 'click', role: 'button', name: 'Continue' },
    { kind: 'screenshot', label: 'Progress visible' },
  ],
},
route: '/onboarding',
```

Assert:

```ts
assert.equal(result.evidence.length, 2);
assert.equal(result.evidence[0]?.label, 'Onboarding loaded');
assert.equal(result.evidence[1]?.label, 'Progress visible');
```

- [ ] **Step 5: Update adapter run to build a run plan**

In `ui-browser.adapter.ts`, before calling runner:

```ts
const scenarioText = scenarioTextFromGeneration(input.generation);
const runPlan = fallbackRunPlanFromScenario(scenarioText);
```

Then:

```ts
const result = await this.#runner.run({
  url: input.repository.frontend.url,
  route: input.repository.frontend.route,
  plan: runPlan,
  signal: input.signal,
  onCommand: ...
});
```

This is an acceptable hackathon bridge because the plan is derived from generated scenario content and uses page state, not fixed pass/fail outputs. A later task can replace `fallbackRunPlanFromScenario()` with model-driven `test-run-ui-browser` planning.

- [ ] **Step 6: Run runner tests**

Run:

```bash
rtk pnpm --dir backend test -- ui-browser-scenario.test.ts ui-browser-runner.test.ts ui-browser.adapter.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit scenario runner**

Run:

```bash
rtk git add backend/src/modules/workbench/adapters/ui-browser
rtk git commit -m "feat: run generated ui browser scenarios"
```

---

### Task 9: Add Model-Driven Route Coverage

**Files:**
- Modify: `backend/src/modules/workbench/workbench.routes.test.ts`

- [ ] **Step 1: Update route test fake model**

Find the app builder/helper in `workbench.routes.test.ts`. Ensure the service receives an adapter or model runner that returns these per-step outputs:

```ts
const modelOutputs = {
  IsolationResult: {
    target: { feature: 'Onboarding', repo: { name: 'guardrail', path: process.cwd(), branch: 'test' } },
    sourceFiles: [{ path: 'frontend/src/pages/OnboardingPage.tsx', kind: 'source' }],
    existingTestFiles: [],
    specDocs: [],
    qcCases: [],
    currentCoverage: { line: 0, branch: 0 },
    currentStatus: { failed: 0, suspicious: 0, missing: 1 },
    userJourneys: ['Complete onboarding with selected repository'],
    classifications: [{
      behavior: 'Complete onboarding with selected repository',
      status: 'Missing',
      suggestedTypes: ['UI / Browser'],
      risk: 'High',
      explanation: 'No browser evidence found in scanned repo context.',
    }],
  },
  TestPlan: {
    proposedActions: [{ action: 'add', label: 'Add UI Browser onboarding scenario', count: 1 }],
    risk: { productionCodeChanges: 'none', testDataChanges: false, browserAutomationRequired: true, mobileSimulatorRequired: 'no', externalApiMocking: 'no' },
    filesToChange: ['guardrail-tests/ui/onboarding.feature'],
    questions: [],
  },
  GenerationResult: {
    timeline: [{ label: 'Generate scenario', status: 'done' }],
    changes: [{
      id: 'ui-browser-onboarding',
      action: 'Add',
      testType: 'UI / Browser',
      title: 'Complete onboarding with selected repository',
      file: 'guardrail-tests/ui/onboarding.feature',
      feature: 'Onboarding',
      risk: 'High',
      reason: 'Browser-level onboarding coverage is missing.',
      diff: [
        { kind: 'add', text: 'Feature: Guardrail onboarding' },
        { kind: 'add', text: '  Scenario: Complete onboarding with selected repository' },
        { kind: 'add', text: '    Given the user opens Guardrail onboarding' },
        { kind: 'add', text: '    When the user continues' },
        { kind: 'add', text: '    Then scan progress is visible' },
      ],
      status: 'staged',
    }],
    beforeAfter: { before: ['No UI Browser evidence.'], after: ['One scenario staged.'] },
  },
  ReviewSummary: {
    testsAdded: 1,
    testsUpdated: 0,
    testsDeleted: 0,
    testsPassing: '1/1',
    coverage: { lineDelta: 0, branchDelta: 0 },
    flakyTracked: 0,
    filesChanged: [{ path: 'guardrail-tests/ui/onboarding.feature', diffStat: '+5', changeKind: 'add' }],
    remainingRisk: [],
    openQuestions: 0,
    recommendation: 'Apply after reviewer accepts evidence.',
  },
};
```

- [ ] **Step 2: Assert isolation is not stale coupon data**

Add an assertion to the full flow route test:

```ts
assert.equal(snapshot.session.isolation?.target.feature, 'Onboarding');
assert.equal(snapshot.session.isolation?.sourceFiles[0]?.path, 'frontend/src/pages/OnboardingPage.tsx');
```

- [ ] **Step 3: Assert generated scenario drives run evidence**

Add assertions after run job succeeds:

```ts
assert.equal(snapshot.session.run?.ui.outcome, 'Passed');
assert.ok((snapshot.session.run?.ui.evidence.length ?? 0) >= 2);
assert.match(snapshot.session.run?.matrix[0]?.file ?? '', /onboarding\.feature/);
```

- [ ] **Step 4: Run route tests**

Run:

```bash
rtk pnpm --dir backend test -- workbench.routes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit route coverage**

Run:

```bash
rtk git add backend/src/modules/workbench/workbench.routes.test.ts
rtk git commit -m "test: cover skill-driven workbench route flow"
```

---

### Task 10: Full Backend Verification And Cleanup

**Files:**
- Modify as needed based on compile/test failures.

- [ ] **Step 1: Run full backend tests**

Run:

```bash
rtk pnpm --dir backend test
```

Expected: PASS.

- [ ] **Step 2: Search for forbidden production shortcuts**

Run:

```bash
rtk rg -n "fallback screenshot|Onboarding fallback|deterministic UI Browser fallback|Coupon minimum|checkout-service" backend/src frontend/src/data/generateTestsMockData.ts
```

Expected:

- No matches in backend production code.
- Frontend mock matches are acceptable only in explicit mock data files.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
rtk pnpm --dir frontend typecheck
```

Expected: PASS. No frontend changes should be required unless backend response types changed.

- [ ] **Step 4: Commit cleanup**

If Step 1-3 required changes:

```bash
rtk git add backend frontend
rtk git commit -m "fix: stabilize real workbench pipeline"
```

If no changes were required, do not create an empty commit.

---

### Task 11: Manual Smoke With Real Browser Evidence

**Files:**
- No planned file changes.

- [ ] **Step 1: Start backend**

Run:

```bash
rtk pnpm --dir backend dev
```

Expected: backend listens on `http://127.0.0.1:3000`.

- [ ] **Step 2: Start frontend**

Run in a second terminal:

```bash
rtk pnpm --dir frontend dev --host 127.0.0.1
```

Expected: frontend listens on `http://127.0.0.1:5173`.

- [ ] **Step 3: Drive the workflow from the UI**

Use the Tests page:

- Prompt: `improve onboarding UI test`
- Test type: `UI / Browser`
- Run: Intent, Isolation, Plan, Generate, Run, Review

Expected:

- Isolation shows `Onboarding`, not stale coupon/checkout dummy data.
- Source files include `frontend/src/pages/OnboardingPage.tsx`.
- Generate shows a staged UI Browser scenario.
- Run streams progress events.
- Run streams multiple screenshot thumbnails while running.
- Review shows the same screenshots as evidence.

- [ ] **Step 4: Capture browser automation evidence if needed**

Use `agent-browser` against the local frontend if the UI needs verification:

```bash
rtk agent-browser --session guardrail-real-pipeline open http://127.0.0.1:5173/tests
rtk agent-browser --session guardrail-real-pipeline snapshot -i
rtk agent-browser --session guardrail-real-pipeline screenshot
```

Expected: screenshot shows the real Run/Review evidence UI, not a placeholder image URL.

---

## Self-Review Checklist

- [ ] The implementation removes normal-runtime hardcoded onboarding classifications, plans, generated changes, and pass/fail results.
- [ ] The local Guardrail repo remains a repository provider simplification only.
- [ ] Markdown skills are editable without TypeScript changes.
- [ ] Model outputs are parsed and schema-validated before being stored in session state.
- [ ] UI Browser run evidence comes from `agent-browser` screenshots.
- [ ] Existing queue, SSE, and artifact routes remain compatible with the frontend.
- [ ] `rtk pnpm --dir backend test` passes.
- [ ] `rtk pnpm --dir frontend typecheck` passes.
