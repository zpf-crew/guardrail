import type { AdapterInput, TestTypeAdapter } from '../test-type-adapter.js';
import type {
  GenerationResult,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  RunOutcome,
  TestPlan,
  TestResultRow,
  TestRunResult,
} from '../../workbench.types.js';
import { buildIsolationContext } from '../../isolation/isolation-context.js';
import { buildIsolationResult } from '../../isolation/isolation-result-builder.js';
import { buildGenerationContext } from '../../generation/generation-context.js';
import { buildTestPlan } from '../../plan/test-plan-builder.js';
import { buildPlanQuestionsContext } from '../../plan/plan-questions-context.js';
import { filterPlanQuestions } from '../../plan/plan-questions-filter.js';
import { buildGenerationResult } from '../../generation/generation-result-builder.js';
import { buildReviewContext } from '../../review/review-context.js';
import { buildReviewSummary } from '../../review/review-summary-builder.js';
import { validateWorkbenchStepResult } from '../../validation/workbench-validators.js';
import { DevServerOrchestrator, type DevServerLease } from '../../dev-server/dev-server-orchestrator.js';
import {
  resolveDevServerTarget,
  type DevServerTarget,
} from '../../dev-server/dev-server-resolver.js';
import { buildRunPlan } from '../../run/run-plan-builder.js';
import { buildRunPlanContext } from '../../run/run-plan-context.js';
import { scenarioTextFromChange } from './ui-browser-scenario.js';
import { UiBrowserRunner, type UiBrowserRunnerResult, type UiBrowserRunnerRunArgs } from './ui-browser-runner.js';

interface UiBrowserRunnerLike {
  run(args: UiBrowserRunnerRunArgs): Promise<UiBrowserRunnerResult>;
}

interface DevServerLike {
  resolve: (clonePath: string, sessionId?: string) => Promise<DevServerTarget | null>;
  start: (target: DevServerTarget, signal: AbortSignal, route?: string) => Promise<DevServerLease>;
  stop: (lease: DevServerLease) => Promise<void>;
}

interface UiBrowserAdapterOptions {
  runner?: UiBrowserRunnerLike;
  devServer?: DevServerLike;
}

interface UiRunOutcome {
  result: UiBrowserRunnerResult;
  targetUrl: string | null;
  matrix: TestResultRow[];
}

function worstRunOutcome(current: RunOutcome, next: RunOutcome): RunOutcome {
  if (next === 'Failed' || current === 'Failed') {
    return 'Failed';
  }
  if (next === 'Flaky' || current === 'Flaky') {
    return 'Flaky';
  }
  return current;
}

function matrixEvidenceLabel(evidence: UiBrowserRunnerResult['evidence']): string | null {
  return evidence.length > 0 ? evidence.map(item => item.kind).join(', ') : null;
}

function uiCommandFor(targetUrl: string | null): string {
  return targetUrl ? `agent-browser open ${targetUrl}` : 'agent-browser open (dev server unavailable)';
}

function durationLabel(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }

  const data = error as { name?: unknown; code?: unknown; message?: unknown };
  return data.name === 'AbortError'
    || data.name === 'CanceledError'
    || data.name === 'CancelledError'
    || data.code === 'ABORT_ERR'
    || data.code === 'ERR_CANCELED'
    || (typeof data.message === 'string' && /\b(abort|aborted|cancelled|canceled)\b/i.test(data.message));
}

function rethrowIfAbort(error: unknown, signal: AbortSignal): void {
  if (signal.aborted || isAbortLike(error)) {
    throw error;
  }
}

function noOpGeneration(reason: string, after: string, feature = 'selected behavior'): GenerationResult {
  return {
    timeline: [
      { label: reason, status: 'done' },
      { label: 'No UI Browser changes generated', status: 'done' },
    ],
    changes: [],
    beforeAfter: { before: [`No staged UI Browser changes for: ${feature}`], after: [after] },
  };
}

function noOpRun(): TestRunResult {
  return {
    unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
    ui: {
      command: 'not run',
      browser: 'Chromium',
      outcome: 'Skipped',
      passed: 0,
      durationMs: 0,
      evidence: [],
    },
    mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    coverage: [
      { metric: 'Line coverage', before: 0, after: 0 },
      { metric: 'Branch coverage', before: 0, after: 0 },
    ],
    matrix: [
      {
        title: '',
        type: 'UI / Browser',
        status: 'Skipped',
        duration: null,
        evidence: null,
        file: '',
      },
    ],
  };
}

export class UiBrowserAdapter implements TestTypeAdapter {
  readonly testType = 'UI / Browser' as const;

  readonly #runner: UiBrowserRunnerLike;
  readonly #devServer: DevServerLike;

  constructor(options: UiBrowserAdapterOptions = {}) {
    this.#runner = options.runner ?? new UiBrowserRunner();
    if (options.devServer) {
      this.#devServer = options.devServer;
    } else {
      const orchestrator = new DevServerOrchestrator();
      this.#devServer = {
        resolve: (clonePath, sessionId) => resolveDevServerTarget(clonePath, { sessionId }),
        start: (target, signal, route) => orchestrator.start(target, signal, route),
        stop: lease => orchestrator.stop(lease),
      };
    }
  }

  async analyze(input: AdapterInput): Promise<IsolationResult> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-isolation-files');
    await input.emit({ type: 'progress', message: 'Classifying behavior gaps from scanned repository context…', percent: 85 });

    let classifications: IsolationResult['classifications'];
    try {
      const modelResult = await input.structuredModel.runStep({
        profile: 'thinker',
        skill,
        schemaName: 'IsolationClassifications',
        context: buildIsolationContext(input.session.intent, input.repository),
        signal: input.signal,
      });
      classifications = modelResult.classifications;
    } catch (error) {
      await input.emit({
        type: 'progress',
        message: `Model classification unavailable; using repository scan fallback. ${error instanceof Error ? error.message : String(error)}`,
        percent: 90,
      });
      classifications = [];
    }

    const result = buildIsolationResult(input.session.intent, input.repository, classifications);
    return validateWorkbenchStepResult('IsolationResult', result);
  }

  async plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-plan');

    await input.emit({ type: 'progress', message: 'Building test plan from isolation evidence…', percent: 12 });
    await input.emit({ type: 'progress', message: `Scoped to ${input.isolation.classifications.length} classified behaviors`, percent: 24 });

    const planContext = buildPlanQuestionsContext(input.isolation, input.repository, input.session.intent);
    if (planContext.resolvedEvidence.routes.length > 0) {
      await input.emit({
        type: 'progress',
        message: `Resolved routes: ${planContext.resolvedEvidence.routes.slice(0, 2).join(' · ')} — agent-browser + managed dev server`,
        percent: 32,
      });
    }

    let questions: TestPlan['questions'] = [];
    try {
      await input.emit({ type: 'progress', message: 'Checking for product behavior conflicts that need your input…', percent: 38 });
      const modelResult = await input.structuredModel.runStep({
        profile: 'thinker',
        skill,
        schemaName: 'TestPlanQuestions',
        context: planContext,
        signal: input.signal,
      });
      questions = filterPlanQuestions(modelResult.questions, input.isolation, input.repository);
      if (modelResult.questions.length > questions.length) {
        await input.emit({
          type: 'progress',
          message: `Dropped ${modelResult.questions.length - questions.length} tooling/route questions already resolved by Guardrail scan`,
          percent: 44,
        });
      }
    } catch (error) {
      await input.emit({
        type: 'progress',
        message: `Plan questions unavailable; continuing with deterministic plan. ${error instanceof Error ? error.message : String(error)}`,
        percent: 42,
      });
    }

    const result = buildTestPlan(input.session.intent, input.isolation, questions);
    await input.emit({
      type: 'progress',
      message: questions.length > 0
        ? `Plan ready — ${result.proposedActions.length} actions, ${questions.length} question(s) need your input`
        : `Plan ready — ${result.proposedActions.length} proposed actions`,
      percent: 48,
    });
    return validateWorkbenchStepResult('TestPlan', result);
  }

  async generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult> {
    input.signal.throwIfAborted();

    const feature = input.session.intent.feature ?? input.session.isolation?.target.feature ?? 'selected behavior';

    if (input.approval.decision === 'cancel') {
      return noOpGeneration('Plan approval canceled', 'No changes generated because approval was canceled.', feature);
    }
    if (input.approval.skipUiTests) {
      return noOpGeneration('UI Browser tests skipped by approval', 'No changes generated because UI Browser tests were skipped.', feature);
    }
    if (input.approval.unitTestsOnly) {
      return noOpGeneration('Unit-tests-only approval selected', 'No UI Browser changes generated because approval requested unit tests only.', feature);
    }

    const isolation = input.session.isolation;
    if (!isolation) throw new Error('Cannot generate without isolation result.');

    const skill = await input.skills.load('test-generate-ui-browser');
    await input.emit({ type: 'progress', message: 'Preparing staged test artifacts from approved plan…', percent: 55 });

    let changes: GenerationResult['changes'] = [];
    try {
      await input.emit({ type: 'progress', message: 'Generating browser scenario diffs…', percent: 62 });
      const modelResult = await input.structuredModel.runStep({
        profile: 'coder',
        skill,
        schemaName: 'GenerationChanges',
        context: buildGenerationContext(
          isolation,
          input.plan,
          input.repository,
          input.session.intent,
          input.approval,
        ),
        signal: input.signal,
      });
      changes = modelResult.changes;
    } catch (error) {
      input.signal.throwIfAborted();
      if (isAbortLike(error)) throw error;
      await input.emit({
        type: 'progress',
        message: `Generation model unavailable; using fallback scenario. ${error instanceof Error ? error.message : String(error)}`,
        percent: 68,
      });
    }

    const result = buildGenerationResult(
      input.session.intent,
      isolation,
      input.plan,
      changes,
      input.repository,
    );
    await input.emit({ type: 'progress', message: `Generated ${result.changes.length} staged change(s)`, percent: 72 });
    return validateWorkbenchStepResult('GenerationResult', result);
  }

  async run(input: AdapterInput & { generation: GenerationResult }): Promise<TestRunResult> {
    input.signal.throwIfAborted();
    await input.emit({ type: 'progress', message: 'Running UI Browser tests.', percent: 75 });

    const uiChanges = input.generation.changes.filter(change => change.testType === 'UI / Browser');
    if (uiChanges.length === 0) {
      return noOpRun();
    }

    const { result: runnerResult, targetUrl, matrix } = await this.#runUi(input);
    const command = uiCommandFor(targetUrl);
    const evidence = runnerResult.evidence;
    const primaryChange = uiChanges[0];
    const passedCount = matrix.filter(row => row.status === 'Passed').length;

    return {
      unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
      ui: {
        command,
        browser: 'Chromium',
        outcome: runnerResult.outcome,
        passed: passedCount,
        durationMs: runnerResult.durationMs,
        evidence,
      },
      mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      coverage: [
        { metric: 'Line coverage', before: 0, after: 0 },
        { metric: 'Branch coverage', before: 0, after: 0 },
      ],
      matrix,
      attention: this.#attentionFor(runnerResult, primaryChange?.title ?? 'UI Browser test'),
    };
  }

  async review(input: AdapterInput & { generation: GenerationResult; run: TestRunResult }): Promise<ReviewSummary> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-review');
    await input.emit({ type: 'progress', message: 'Summarizing run evidence for review…', percent: 92 });

    const isolation = input.session.isolation;
    if (!isolation) throw new Error('Cannot review without isolation result.');
    const plan = input.session.plan;
    if (!plan) throw new Error('Cannot review without plan result.');
    const approval = input.session.approval ?? { decision: 'approve', answers: {} };

    let recommendation = 'Review generated changes and run evidence before applying.';
    try {
      const modelResult = await input.structuredModel.runStep({
        profile: 'thinker',
        skill,
        schemaName: 'ReviewRecommendation',
        context: buildReviewContext({
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

    const result = buildReviewSummary(
      { generation: input.generation, run: input.run, plan, approval },
      recommendation,
    );
    await input.emit({ type: 'progress', message: 'Review summary ready', percent: 98 });
    return validateWorkbenchStepResult('ReviewSummary', result);
  }

  async #runUi(input: AdapterInput & { generation: GenerationResult }): Promise<UiRunOutcome> {
    const uiChanges = input.generation.changes.filter(change => change.testType === 'UI / Browser');
    const defaultRoute = input.repository.frontend?.route ?? '/';
    const isolation = input.session.isolation;
    if (!isolation) throw new Error('Cannot run UI Browser tests without isolation result.');

    const failedMatrix = (errorMessage: string): UiRunOutcome => ({
      result: {
        outcome: 'Failed',
        durationMs: 0,
        evidence: [],
        errorMessage,
      },
      targetUrl: null,
      matrix: uiChanges.map(change => ({
        title: change.title,
        type: 'UI / Browser',
        status: 'Failed',
        duration: null,
        evidence: null,
        file: change.file,
      })),
    });

    let commandProgress = Promise.resolve();
    const clonePath = input.repository.repo.path;
    const sessionId = input.session.id;
    let lease: DevServerLease | null = null;
    let targetUrl: string | null = null;
    const matrix: TestResultRow[] = [];
    const allEvidence: UiBrowserRunnerResult['evidence'] = [];
    let totalDuration = 0;
    let worstOutcome: RunOutcome = 'Passed';

    try {
      const target = await this.#devServer.resolve(clonePath, sessionId);
      if (!target) {
        return failedMatrix('No dev server could be resolved for this repository.');
      }

      await input.emit({ type: 'progress', message: 'Starting managed dev server.', percent: 76 });
      lease = await this.#devServer.start(target, input.signal, defaultRoute);
      targetUrl = `${lease.baseUrl}${lease.route}`;
      await input.emit({
        type: 'progress',
        message: `Dev server ready at ${targetUrl}.`,
        percent: 77,
      });

      for (const [changeIndex, change] of uiChanges.entries()) {
        input.signal.throwIfAborted();
        const scenarioText = scenarioTextFromChange(change);
        let modelPlan = null;
        try {
          const skill = await input.skills.load('test-run-ui-browser');
          modelPlan = await input.structuredModel.runStep({
            profile: 'coder',
            skill,
            schemaName: 'UiBrowserRunPlan',
            context: buildRunPlanContext({
              change,
              scenarioText,
              repository: input.repository,
              isolation,
              targetUrl: lease.baseUrl,
            }),
            signal: input.signal,
          });
        } catch (error) {
          rethrowIfAbort(error, input.signal);
        }

        const plan = await buildRunPlan({
          scenarioText,
          modelPlan: modelPlan ?? null,
          defaultRoute,
        });
        const runRoute = plan.actions[0]?.kind === 'open' ? plan.actions[0].path : defaultRoute;

        await input.emit({
          type: 'progress',
          message: `Opening frontend in agent-browser (${changeIndex + 1}/${uiChanges.length}).`,
          percent: Math.min(89, 78 + Math.round((changeIndex / uiChanges.length) * 10)),
        });

        const changeResult = await this.#runner.run({
          url: lease.baseUrl,
          route: runRoute,
          plan,
          signal: input.signal,
          onCommand: (args, index, total) => {
            commandProgress = commandProgress.then(() => input.emit({
              type: 'progress',
              message: `Running agent-browser ${args[0]} (${index + 1}/${total}).`,
              percent: Math.min(90, 78 + Math.round(((changeIndex + (index + 1) / total) / uiChanges.length) * 10)),
            })).then(() => undefined);
          },
        });
        await commandProgress;

        const changeEvidence: UiBrowserRunnerResult['evidence'] = [];
        for (const item of changeResult.evidence) {
          if (item.kind === 'screenshot') {
            const emitted = await input.emit({ type: 'screenshot', artifact: item });
            if (emitted.type === 'screenshot') changeEvidence.push(emitted.artifact);
          } else {
            changeEvidence.push(item);
          }
        }

        totalDuration += changeResult.durationMs;
        worstOutcome = worstRunOutcome(worstOutcome, changeResult.outcome);
        allEvidence.push(...changeEvidence);
        matrix.push({
          title: change.title,
          type: 'UI / Browser',
          status: changeResult.outcome,
          duration: durationLabel(changeResult.durationMs),
          evidence: matrixEvidenceLabel(changeEvidence),
          evidenceItems: changeEvidence.length > 0 ? changeEvidence : undefined,
          file: change.file,
        });
      }

      return {
        result: {
          outcome: worstOutcome,
          durationMs: totalDuration,
          evidence: allEvidence,
        },
        targetUrl,
        matrix,
      };
    } catch (error) {
      await commandProgress;
      rethrowIfAbort(error, input.signal);
      await input.emit({
        type: 'progress',
        message: `Warning: UI Browser runner failed. ${error instanceof Error ? error.message : String(error)}`,
        percent: 80,
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      const remainingChanges = uiChanges.slice(matrix.length);
      for (const change of remainingChanges) {
        matrix.push({
          title: change.title,
          type: 'UI / Browser',
          status: 'Failed',
          duration: null,
          evidence: null,
          file: change.file,
        });
      }
      return {
        result: {
          outcome: 'Failed',
          durationMs: totalDuration,
          evidence: allEvidence,
          errorMessage,
        },
        targetUrl,
        matrix,
      };
    } finally {
      if (lease) {
        await this.#devServer.stop(lease);
      }
    }
  }

  #attentionFor(result: UiBrowserRunnerResult, testTitle: string): TestRunResult['attention'] {
    if (result.outcome !== 'Failed' && result.outcome !== 'Flaky') {
      return undefined;
    }

    return {
      testTitle,
      kind: result.outcome === 'Flaky' ? 'flaky' : 'failed',
      reason: result.errorMessage ?? `UI Browser runner reported ${result.outcome.toLowerCase()} outcome.`,
      likelyCause: result.outcome === 'Flaky'
        ? 'The UI or browser automation has inconsistent timing or state.'
        : 'The local frontend page was unavailable or did not reach the expected state.',
      suggestedFix: result.outcome === 'Flaky'
        ? 'Review the captured trace and stabilize wait conditions before applying.'
        : 'Start the frontend and rerun the UI Browser scenario.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    };
  }
}
