import type { AdapterInput, TestTypeAdapter } from '../test-type-adapter.js';
import type {
  GenerationResult,
  GeneratedChange,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  RunOutcome,
  TestPlan,
  TestResultRow,
  TestRunResult,
} from '../../workbench.types.js';
import { buildIsolationResult } from '../../isolation/isolation-result-builder.js';
import { buildTestPlan } from '../../plan/test-plan-builder.js';
import { filterPlanQuestions } from '../../plan/plan-questions-filter.js';
import { buildReviewSummary } from '../../review/review-summary-builder.js';
import { validateWorkbenchStepResult } from '../../validation/workbench-validators.js';
import { deriveUnitGenerationScope } from './unit-generation-scope.js';
import {
  buildUnitGenerationContext,
  buildUnitIsolationContext,
  buildUnitPlanContext,
  buildUnitReviewContext,
  buildUnitRunContext,
} from './unit-context.js';
import { materializeGeneratedChanges } from '../../generation/generated-change-writer.js';
import { createUnitWorktree, type UnitWorktreeLease } from './unit-worktree.js';
import { resolveUnitTestCommand } from './unit-test-command-resolver.js';
import { runUnitTestCommand } from './unit-test-runner.js';
import {
  detectExpectedUnitRunner,
  validateGeneratedUnitContent,
  type ExpectedUnitRunner,
} from './unit-test-runner-style.js';

interface UnitWorktreeLike {
  create(repoRoot: string): Promise<UnitWorktreeLease>;
}

interface UnitAdapterOptions {
  worktree?: UnitWorktreeLike;
  runCommand?: typeof runUnitTestCommand;
}

const UNIT_GENERATION_CONCURRENCY = 2;

function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (!error || typeof error !== 'object') return false;
  const data = error as { name?: unknown; code?: unknown; message?: unknown };
  return data.name === 'AbortError'
    || data.code === 'ABORT_ERR'
    || (typeof data.message === 'string' && /\b(abort|aborted|cancelled|canceled)\b/i.test(data.message));
}

function rethrowIfAbort(error: unknown, signal: AbortSignal): void {
  if (signal.aborted || isAbortLike(error)) throw error;
}

function durationLabel(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isModelResponseError(message: string): boolean {
  return /LLM response did not contain assistant content/i.test(message)
    || /Model returned invalid JSON/i.test(message)
    || /LLM is not configured/i.test(message);
}

function noOpRun(): TestRunResult {
  return {
    unit: { command: 'not run', outcome: 'Skipped', passed: 0, failed: 0, durationMs: 0, suite: 'Unit' },
    ui: { command: 'not run', browser: 'Chromium', outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    coverage: [],
    matrix: [],
  };
}

function worstRunOutcome(current: RunOutcome, next: RunOutcome): RunOutcome {
  if (next === 'Failed' || current === 'Failed') return 'Failed';
  if (next === 'Flaky' || current === 'Flaky') return 'Flaky';
  if (next === 'Skipped' && current === 'Passed') return 'Skipped';
  return current;
}

function unitPlanFiles(isolation: IsolationResult, fallbackFeature: string): string[] {
  const existing = isolation.existingTestFiles
    .map(file => file.path)
    .filter(path => /\.(test|spec)\.[cm]?[jt]sx?$/i.test(path));
  if (existing.length > 0) return [...new Set(existing.slice(0, 2))];
  const slug = fallbackFeature.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unit';
  return [`guardrail-tests/unit/${slug}.test.ts`];
}

function normalizeUnitChanges(
  modelChanges: GeneratedChange[],
  scoped: ReturnType<typeof deriveUnitGenerationScope>,
  fallbackFeature: string,
  runner: ExpectedUnitRunner,
  includeUnmatched = true,
): GeneratedChange[] {
  const used = new Set<number>();
  const resolved: GeneratedChange[] = [];

  for (const scope of scoped) {
    const index = scoped.length === 1 && !includeUnmatched
      ? (modelChanges.length > 0 ? 0 : -1)
      : modelChanges.findIndex((change, i) =>
        !used.has(i) && (
          change.title.toLowerCase() === scope.behavior.toLowerCase()
          || change.title.toLowerCase().includes(scope.behavior.toLowerCase())
          || scope.behavior.toLowerCase().includes(change.title.toLowerCase())
        ));
    const base = index >= 0 ? modelChanges[index] : undefined;
    if (!base) {
      throw new Error(`Unit generation did not return a change for scoped behavior: ${scope.behavior}`);
    }
    used.add(index);
    if (!base.content?.trim()) {
      throw new Error(`Generated unit test is missing complete file content: ${base.file || scope.file}`);
    }
    const normalized = {
      ...base,
      action: scope.action,
      testType: 'Unit' as const,
      title: scoped.length === 1 && !includeUnmatched ? scope.behavior : (base.title.trim() || scope.behavior),
      file: scoped.length === 1 && !includeUnmatched ? scope.file : (base.file.trim() || scope.file),
      feature: base.feature || fallbackFeature,
      risk: scoped.length === 1 && !includeUnmatched ? scope.risk : (base.risk || scope.risk),
      content: base.content,
      status: 'staged' as const,
    };
    validateGeneratedUnitContent(normalized.content, runner, normalized.file);
    resolved.push({
      ...normalized,
      diff: normalized.diff.length > 0
        ? normalized.diff
        : normalized.content.split('\n').map(text => ({ kind: 'add' as const, text })),
    });
  }

  if (!includeUnmatched) return resolved;

  for (let index = 0; index < modelChanges.length; index += 1) {
    if (used.has(index)) continue;
    const change = modelChanges[index]!;
    if (!change.content?.trim()) {
      throw new Error(`Generated unit test is missing complete file content: ${change.file}`);
    }
    resolved.push({
      ...change,
      testType: 'Unit',
      content: change.content,
      status: 'staged',
    });
    validateGeneratedUnitContent(resolved[resolved.length - 1]!.content ?? '', runner, resolved[resolved.length - 1]!.file);
  }

  return resolved;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}

export class UnitAdapter implements TestTypeAdapter {
  readonly testType = 'Unit' as const;

  readonly #worktree: UnitWorktreeLike;
  readonly #runCommand: typeof runUnitTestCommand;

  constructor(options: UnitAdapterOptions = {}) {
    this.#worktree = options.worktree ?? { create: createUnitWorktree };
    this.#runCommand = options.runCommand ?? runUnitTestCommand;
  }

  async analyze(input: AdapterInput): Promise<IsolationResult> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-isolation-unit');
    await input.emit({ type: 'progress', message: 'Classifying unit-level behavior gaps from repository context…', percent: 85 });
    let classifications: IsolationResult['classifications'] = [];
    try {
      const modelResult = await input.structuredModel.runStep({
        profile: 'thinker',
        skill,
        schemaName: 'IsolationClassifications',
        context: buildUnitIsolationContext(input.session.intent, input.repository),
        signal: input.signal,
      });
      classifications = modelResult.classifications;
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      await input.emit({
        type: 'progress',
        message: `Unit classification model unavailable; using repository scan fallback. ${error instanceof Error ? error.message : String(error)}`,
        percent: 90,
      });
    }

    const result = buildIsolationResult(input.session.intent, input.repository, classifications);
    return validateWorkbenchStepResult('IsolationResult', result);
  }

  async plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-plan-unit');
    await input.emit({ type: 'progress', message: 'Building unit test plan from isolation evidence…', percent: 12 });
    let questions: TestPlan['questions'] = [];
    try {
      await input.emit({ type: 'progress', message: 'Checking unit assertion assumptions with the model…', percent: 38 });
      const modelResult = await input.structuredModel.runStep({
        profile: 'thinker',
        skill,
        schemaName: 'TestPlanQuestions',
        context: buildUnitPlanContext(input.isolation, input.repository, input.session.intent),
        signal: input.signal,
      });
      questions = filterPlanQuestions(modelResult.questions, input.isolation, input.repository);
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      await input.emit({
        type: 'progress',
        message: `Unit plan questions unavailable; continuing with deterministic plan. ${error instanceof Error ? error.message : String(error)}`,
        percent: 42,
      });
    }
    const result = buildTestPlan(input.session.intent, input.isolation, questions);
    return validateWorkbenchStepResult('TestPlan', {
      ...result,
      filesToChange: unitPlanFiles(input.isolation, input.isolation.target.feature),
      risk: { ...result.risk, browserAutomationRequired: false },
    });
  }

  async generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult> {
    input.signal.throwIfAborted();
    const isolation = input.session.isolation;
    if (!isolation) throw new Error('Cannot generate unit tests without isolation result.');
    const feature = isolation.target.feature || input.session.intent.feature || 'selected behavior';

    if (input.approval.decision === 'cancel') {
      return {
        timeline: [{ label: 'Plan approval canceled', status: 'done' }],
        changes: [],
        beforeAfter: { before: [`No generated unit tests for: ${feature}`], after: ['No changes generated because approval was canceled.'] },
      };
    }

    const scoped = deriveUnitGenerationScope(isolation, input.plan);
    if (scoped.length === 0) {
      throw new Error('Unit generation has no approved behaviors to generate.');
    }
    await input.emit({
      type: 'progress',
      message: `Unit generation scope ready — ${scoped.length} behavior(s), ${scoped.map(item => item.file).join(', ')}`,
      percent: 56,
    });
    const expectedRunner = await detectExpectedUnitRunner(input.repository);
    await input.emit({
      type: 'progress',
      message: `Detected unit runner style: ${expectedRunner.importSource}`,
      percent: 58,
    });
    const skill = await input.skills.load('test-generate-unit');
    await input.emit({ type: 'progress', message: 'Generating unit test file content from approved plan…', percent: 62 });
    const generated = await mapWithConcurrency(
      scoped,
      UNIT_GENERATION_CONCURRENCY,
      async (scope, index) => {
        let validationErrors: string[] = [];
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const generationContext = buildUnitGenerationContext(
            isolation,
            input.plan,
            input.repository,
            input.session.intent,
            input.approval,
            [scope],
            expectedRunner,
            validationErrors,
          );
          let modelResult: { changes: GeneratedChange[] };
          let modelLabel = 'Coder';
          await input.emit({
            type: 'progress',
            message: `Generating unit test ${index + 1}/${scoped.length}: ${scope.behavior} (attempt ${attempt}/2)…`,
            percent: Math.min(70, 63 + Math.round((index / scoped.length) * 6)),
          });
          try {
            modelResult = await input.structuredModel.runStep({
              profile: 'coder',
              skill,
              schemaName: 'GenerationChanges',
              context: generationContext,
              signal: input.signal,
            });
          } catch (error) {
            rethrowIfAbort(error, input.signal);
            const message = errorMessage(error);
            if (!isModelResponseError(message)) throw error;
            await input.emit({
              type: 'progress',
              message: `Coder model response failed for "${scope.behavior}"; falling back to thinker model. ${message}`,
              percent: 67,
            });
            modelLabel = 'Thinker fallback';
            try {
              modelResult = await input.structuredModel.runStep({
                profile: 'thinker',
                skill,
                schemaName: 'GenerationChanges',
                context: generationContext,
                signal: input.signal,
              });
            } catch (fallbackError) {
              rethrowIfAbort(fallbackError, input.signal);
              throw new Error(
                `Unit generation model response failed for "${scope.behavior}". Coder: ${message}. Thinker fallback: ${errorMessage(fallbackError)}`,
              );
            }
          }

          try {
            const resolved = normalizeUnitChanges(modelResult.changes, [scope], feature, expectedRunner, false);
            await input.emit({
              type: 'progress',
              message: `${modelLabel} validated unit test ${index + 1}/${scoped.length}: ${scope.behavior}`,
              percent: Math.min(72, 66 + Math.round(((index + 1) / scoped.length) * 6)),
            });
            return resolved[0]!;
          } catch (error) {
            rethrowIfAbort(error, input.signal);
            validationErrors = [errorMessage(error)];
            if (attempt === 2) {
              throw new Error(
                `Unit test generation failed validation for "${scope.behavior}" after 2 attempts: ${validationErrors[0]}`,
              );
            }
            await input.emit({
              type: 'progress',
              message: `Generated unit test for "${scope.behavior}" was invalid; retrying with validation feedback. ${validationErrors[0]}`,
              percent: 68,
            });
          }
        }
        throw new Error(`Unit test generation did not produce a validated change for "${scope.behavior}".`);
      },
    );
    const resolvedChanges = generated;
    const result: GenerationResult = {
      timeline: [
        { label: 'Map plan actions to unit test files', status: 'done' },
        { label: `Stage ${resolvedChanges.length} unit test artifact${resolvedChanges.length === 1 ? '' : 's'}`, status: 'done' },
      ],
      changes: resolvedChanges,
      beforeAfter: {
        before: [`No generated unit changes for: ${input.session.intent.prompt || feature}`],
        after: resolvedChanges.map(change => `${change.action} Unit — ${change.title}`),
      },
    };
    return validateWorkbenchStepResult('GenerationResult', result);
  }

  async run(input: AdapterInput & { generation: GenerationResult }): Promise<TestRunResult> {
    input.signal.throwIfAborted();
    const unitChanges = input.generation.changes.filter(change => change.testType === 'Unit');
    if (unitChanges.length === 0) return noOpRun();

    await input.emit({ type: 'progress', message: 'Running generated unit tests in an isolated worktree…', percent: 75 });
    let lease: UnitWorktreeLease | null = null;
    const matrix: TestResultRow[] = [];
    let command = 'not run';
    let totalDuration = 0;
    let outcome: RunOutcome = 'Passed';

    try {
      lease = await this.#worktree.create(input.repository.repo.path);
      const expectedRunner = await detectExpectedUnitRunner(input.repository);
      for (const change of unitChanges) {
        validateGeneratedUnitContent(change.content ?? '', expectedRunner, change.file);
      }
      await materializeGeneratedChanges(lease.path, unitChanges);

      for (const [index, change] of unitChanges.entries()) {
        input.signal.throwIfAborted();
        const resolved = await resolveUnitTestCommand(lease.path, change.file);
        const skill = await input.skills.load('test-run-unit');
        await input.structuredModel.runStep({
          profile: 'coder',
          skill,
          schemaName: 'UnitRunPlan',
          context: buildUnitRunContext({
            change,
            repository: input.repository,
            commandCandidates: [resolved.focusedCommand, resolved.fullCommand],
          }),
          signal: input.signal,
        }).catch(error => {
          rethrowIfAbort(error, input.signal);
        });

        await input.emit({
          type: 'progress',
          message: `Running generated unit test (${index + 1}/${unitChanges.length}): ${change.file}`,
          percent: Math.min(90, 78 + Math.round((index / unitChanges.length) * 10)),
        });

        const result = await this.#runCommand(resolved, input.signal);
        command = result.command;
        totalDuration += result.durationMs;
        outcome = worstRunOutcome(outcome, result.outcome);
        matrix.push({
          title: change.title,
          type: 'Unit',
          status: result.outcome,
          duration: durationLabel(result.durationMs),
          evidence: result.usedFallback ? 'focused fallback' : 'focused run',
          reason: result.outcome === 'Passed' ? null : result.output.slice(0, 1000) || 'Generated unit test command failed.',
          file: change.file,
        });
      }
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      const message = error instanceof Error ? error.message : String(error);
      outcome = 'Failed';
      for (const change of unitChanges.slice(matrix.length)) {
        matrix.push({
          title: change.title,
          type: 'Unit',
          status: 'Failed',
          duration: null,
          evidence: null,
          reason: message,
          file: change.file,
        });
      }
    } finally {
      if (lease) await lease.cleanup();
    }

    const passed = matrix.filter(row => row.status === 'Passed').length;
    const failed = matrix.filter(row => row.status === 'Failed').length;
    return {
      unit: { command, outcome, passed, failed, durationMs: totalDuration, suite: 'Unit' },
      ui: { command: 'not run', browser: 'Chromium', outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      coverage: [],
      matrix,
      attention: this.#attentionFor(matrix),
    };
  }

  async review(input: AdapterInput & { generation: GenerationResult; run: TestRunResult }): Promise<ReviewSummary> {
    input.signal.throwIfAborted();
    const isolation = input.session.isolation;
    const plan = input.session.plan;
    if (!isolation) throw new Error('Cannot review unit tests without isolation result.');
    if (!plan) throw new Error('Cannot review unit tests without plan result.');
    const approval = input.session.approval ?? { decision: 'approve', answers: {} };
    const skill = await input.skills.load('test-review-unit');
    let recommendation = 'Review generated unit tests and command output before applying.';
    try {
      const modelResult = await input.structuredModel.runStep({
        profile: 'thinker',
        skill,
        schemaName: 'ReviewRecommendation',
        context: buildUnitReviewContext({
          intent: input.session.intent,
          isolation,
          plan,
          approval,
          generation: input.generation,
          run: input.run,
          repository: input.repository,
        }),
        signal: input.signal,
      });
      recommendation = modelResult.recommendation;
    } catch {
      // deterministic fallback recommendation already set
    }
    return validateWorkbenchStepResult('ReviewSummary', buildReviewSummary({
      generation: input.generation,
      run: input.run,
      plan,
      approval,
    }, recommendation));
  }

  #attentionFor(matrix: TestResultRow[]): TestRunResult['attention'] {
    const failed = matrix.find(row => row.status === 'Failed' || row.status === 'Flaky');
    if (!failed) return undefined;
    return {
      testTitle: failed.title,
      kind: failed.status === 'Flaky' ? 'flaky' : 'failed',
      reason: failed.reason ?? `Unit test reported ${failed.status.toLowerCase()} outcome.`,
      likelyCause: failed.status === 'Flaky'
        ? 'Generated unit test has unstable timing or shared state.'
        : 'Generated unit test assertion, import, setup, or command failed.',
      suggestedFix: 'Review generated test content and command output, then regenerate or edit before applying.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    };
  }
}
