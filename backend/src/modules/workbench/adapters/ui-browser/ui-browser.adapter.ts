import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AdapterInput, TestTypeAdapter } from '../test-type-adapter.js';
import type {
  GeneratedChange,
  GenerationResult,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  RunOutcome,
  ScenarioRunResult,
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
import {
  validateWorkbenchStepResult,
  type UiBrowserAcceptedFlow,
  type UiBrowserExecutionPlan,
  type UiBrowserUserFlowPlan,
} from '../../validation/workbench-validators.js';
import { DevServerOrchestrator, type DevServerLease, type DevServerLogEvent } from '../../dev-server/dev-server-orchestrator.js';
import {
  diagnoseDevServerResolution,
  resolveDevServerTarget,
  type DevServerTarget,
} from '../../dev-server/dev-server-resolver.js';
import { lookupRunConstraints } from '../../plan/run-constraints.js';
import { AgentModelRunner } from '../../model/agent-model-runner.js';
import {
  buildDroppedScenarioRows,
  buildExecutionPlanTraceEvidence,
  indexedScenariosFromChange,
  sanitizeExecutionPlan,
  sourceScenariosForFlow,
  type IndexedUiScenario,
} from './ui-browser-flow-plan.js';
import { UiBrowserAgentRunner, type RunScenarioArgs } from './ui-browser-agent-runner.js';
import { defaultAgentExecutor, sessionAgentExecutor } from './ui-browser-agent-executor.js';
import {
  buildAgentBrowserRunSkillContent,
  loadAgentBrowserCoreGuide,
} from './agent-browser-core-guide.js';

type RunScenarioWithExecutionPlanArgs = RunScenarioArgs & {
  executionPlan?: UiBrowserExecutionPlan;
};

interface AgentRunnerLike {
  runScenario(args: RunScenarioWithExecutionPlanArgs): Promise<ScenarioRunResult>;
}

interface PendingFlowRun {
  change: GeneratedChange;
  flow: UiBrowserAcceptedFlow;
  sourceScenarios: IndexedUiScenario[];
}

interface DevServerLike {
  resolve: (clonePath: string, sessionId?: string) => Promise<DevServerTarget | null>;
  start: (
    target: DevServerTarget,
    signal: AbortSignal,
    route?: string,
    onLog?: (event: DevServerLogEvent) => void,
  ) => Promise<DevServerLease>;
  stop: (lease: DevServerLease) => Promise<void>;
}

interface UiBrowserAdapterOptions {
  agentRunner?: AgentRunnerLike;
  devServer?: DevServerLike;
}

interface UiRunOutcome {
  result: {
    outcome: RunOutcome;
    durationMs: number;
    evidence: ScenarioRunResult['evidence'];
    errorMessage?: string;
  };
  targetUrl: string | null;
  matrix: TestResultRow[];
}

function runOutcomeFromMatrix(matrix: TestResultRow[]): RunOutcome {
  if (matrix.some(row => row.status === 'Failed')) return 'Failed';
  if (matrix.some(row => row.status === 'Flaky')) return 'Flaky';
  if (matrix.some(row => row.status === 'Passed')) return 'Passed';
  return 'Skipped';
}

function matrixEvidenceLabelFromItems(evidence: Array<{ kind: string }>): string | null {
  return evidence.length > 0 ? evidence.map(item => item.kind).join(', ') : null;
}

function uiCommandFor(targetUrl: string | null): string {
  return targetUrl ? `agent-browser open ${targetUrl}` : 'agent-browser open (dev server unavailable)';
}

function sanitizeLogChunk(text: string): string {
  return text.replace(/https?:\/\/x-access-token:[^@\s]+@/g, 'https://x-access-token:<redacted>@');
}

function shortLogChunk(text: string): string {
  const compact = sanitizeLogChunk(text).trim().replace(/\s+/g, ' ');
  return compact.length > 220 ? `${compact.slice(0, 220)}…` : compact;
}

function logRunDiagnostic(message: string): void {
  console.log(`[workbench-ui-run] ${message}`);
}

function resolveManualTarget(manualBaseUrl: string | undefined, defaultRoute: string): { baseUrl: string; route: string; targetUrl: string } | null {
  const raw = manualBaseUrl?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Manual app URL must be a valid http:// or https:// URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Manual app URL must use http:// or https://.');
  }
  const route = url.pathname === '/' && !url.search && !url.hash
    ? defaultRoute
    : `${url.pathname}${url.search}${url.hash}`;
  return { baseUrl: url.origin, route, targetUrl: `${url.origin}${route}` };
}

function durationLabel(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

async function collectScenarioEvidence(
  input: AdapterInput,
  scenarioResult: ScenarioRunResult,
  liveScreenshotHrefs: Set<string>,
): Promise<ScenarioRunResult['evidence']> {
  const changeEvidence: ScenarioRunResult['evidence'] = [];
  for (const item of scenarioResult.evidence) {
    if (item.kind === 'screenshot') {
      if (item.href && (liveScreenshotHrefs.has(item.href) || item.href.startsWith('/api/workbench/'))) {
        changeEvidence.push(item);
      } else {
        const emitted = await input.emit({ type: 'screenshot', artifact: item });
        if (emitted.type === 'screenshot') changeEvidence.push(emitted.artifact);
      }
    } else {
      changeEvidence.push(item);
    }
  }
  return changeEvidence;
}

async function buildUiBrowserRunTraceEvidence(
  evidence: ScenarioRunResult['evidence'],
): Promise<ScenarioRunResult['evidence'][number] | null> {
  const traces = evidence.filter(item => item.kind === 'trace' && item.href && path.isAbsolute(item.href));
  if (traces.length === 0) return null;

  const files = await Promise.all(traces.map(async item => {
    try {
      const content = await readFile(item.href!, 'utf8');
      return {
        label: item.label,
        href: item.href,
        content: JSON.parse(content) as unknown,
      };
    } catch {
      return {
        label: item.label,
        href: item.href,
        content: null,
      };
    }
  }));

  try {
    const dir = path.join(os.tmpdir(), 'guardrail-ui-browser-run-traces');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${randomUUID()}.json`);
    await writeFile(
      filePath,
      `${JSON.stringify({ kind: 'ui-browser-run-trace', traces: files }, null, 2)}\n`,
      'utf8',
    );
    return { kind: 'trace', label: 'UI Browser raw run trace', href: filePath };
  } catch {
    return null;
  }
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
        reason: null,
        file: '',
      },
    ],
  };
}

export class UiBrowserAdapter implements TestTypeAdapter {
  readonly testType = 'UI / Browser' as const;

  readonly #agentRunner: AgentRunnerLike | null;
  readonly #devServer: DevServerLike;

  constructor(options: UiBrowserAdapterOptions = {}) {
    this.#agentRunner = options.agentRunner ?? null;
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
    let runConstraintOverrides: TestPlan['runConstraints'] = [];
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
      runConstraintOverrides = modelResult.runConstraintOverrides ?? [];
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

    const result = buildTestPlan(input.session.intent, input.isolation, questions, runConstraintOverrides);
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

  async run(input: AdapterInput & { generation: GenerationResult; runOptions?: { manualBaseUrl?: string } }): Promise<TestRunResult> {
    input.signal.throwIfAborted();
    await input.emit({ type: 'progress', message: 'Running UI Browser tests.', percent: 75 });

    const uiChanges = input.generation.changes.filter(change => change.testType === 'UI / Browser');
    if (uiChanges.length === 0) {
      return noOpRun();
    }

    const { result: runnerResult, targetUrl, matrix } = await this.#runUi(input);
    const command = uiCommandFor(targetUrl);
    const evidence = runnerResult.evidence;
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
      attention: this.#attentionFor(matrix),
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

  async #runUi(input: AdapterInput & { generation: GenerationResult; runOptions?: { manualBaseUrl?: string } }): Promise<UiRunOutcome> {
    const uiChanges = input.generation.changes.filter(change => change.testType === 'UI / Browser');
    let defaultRoute = input.repository.frontend?.route ?? '/';
    const isolation = input.session.isolation;
    if (!isolation) throw new Error('Cannot run UI Browser tests without isolation result.');

    const notRunMatrix = (reason: string): UiRunOutcome => ({
      result: {
        outcome: 'Skipped',
        durationMs: 0,
        evidence: [],
        errorMessage: reason,
      },
      targetUrl: null,
      matrix: uiChanges.map(change => ({
        title: change.title,
        type: 'UI / Browser',
        status: 'Skipped',
        duration: null,
        evidence: null,
        reason,
        file: change.file,
      })),
    });

    const clonePath = input.repository.repo.path;
    const sessionId = input.session.id;
    let lease: DevServerLease | null = null;
    let targetUrl: string | null = null;
    const matrix: TestResultRow[] = [];
    const allEvidence: ScenarioRunResult['evidence'] = [];
    let totalDuration = 0;
    const pendingFlowRuns: PendingFlowRun[] = [];
    let completedFlowRunCount = 0;

    try {
      const manualTarget = resolveManualTarget(input.runOptions?.manualBaseUrl, defaultRoute);
      if (manualTarget) {
        await input.emit({
          type: 'progress',
          message: `Using provided app URL for UI Browser run: ${manualTarget.targetUrl}`,
          percent: 76,
        });
        defaultRoute = manualTarget.route;
        lease = {
          baseUrl: manualTarget.baseUrl,
          route: manualTarget.route,
          stop: async () => {},
        };
        targetUrl = manualTarget.targetUrl;
      } else {
        const diagnostics = await diagnoseDevServerResolution(clonePath);
        for (const diagnostic of diagnostics) {
          logRunDiagnostic(diagnostic);
          await input.emit({
            type: 'progress',
            message: `[dev-server:resolve] ${diagnostic}`,
            percent: 75,
          });
        }

        const target = await this.#devServer.resolve(clonePath, sessionId);
        if (!target) {
          return notRunMatrix('No dev server could be resolved for this repository. Choose a running app URL to run UI Browser tests.');
        }

        await input.emit({ type: 'progress', message: 'Installing target repository dependencies.', percent: 75 });
        await input.emit({ type: 'progress', message: 'Starting managed dev server.', percent: 76 });
        lease = await this.#devServer.start(target, input.signal, defaultRoute, event => {
          const chunk = shortLogChunk(event.text);
          if (!chunk) return;
          logRunDiagnostic(`[dev-server:${event.source}:${event.stream}] ${chunk}`);
          void input.emit({
            type: 'progress',
            message: `[dev-server:${event.source}:${event.stream}] ${chunk}`,
            percent: 76,
          });
        });
        targetUrl = `${lease.baseUrl}${lease.route}`;
        await input.emit({
          type: 'progress',
          message: `Dev server ready at ${targetUrl}.`,
          percent: 77,
        });
      }

      for (const [changeIndex, change] of uiChanges.entries()) {
        input.signal.throwIfAborted();
        const scenarios = indexedScenariosFromChange(change);
        let flowPlan: UiBrowserUserFlowPlan;
        try {
          flowPlan = await this.#planFlows(input, change, scenarios, changeIndex, uiChanges.length);
        } catch (error) {
          rethrowIfAbort(error, input.signal);
          const message = error instanceof Error ? error.message : String(error);
          matrix.push({
            title: change.title,
            type: 'UI / Browser',
            status: 'Failed',
            duration: null,
            evidence: null,
            reason: `Flow planning failed: ${message}`,
            file: change.file,
          });
          continue;
        }

        const executionPlans: UiBrowserExecutionPlan[] = [];
        matrix.push(...buildDroppedScenarioRows(change, scenarios, flowPlan.droppedScenarios));

        if (flowPlan.acceptedFlows.length === 0) {
          const trace = await buildExecutionPlanTraceEvidence({ flowPlan, executionPlans });
          if (trace) allEvidence.push(trace);
          continue;
        }

        for (const flow of flowPlan.acceptedFlows) {
          let sourceScenarios: IndexedUiScenario[];
          let executionPlan: UiBrowserExecutionPlan;
          try {
            sourceScenarios = sourceScenariosForFlow(scenarios, flow.sourceScenarioIndexes);
            executionPlan = await this.#planExecution(input, flow, sourceScenarios, defaultRoute);
          } catch (error) {
            rethrowIfAbort(error, input.signal);
            const message = error instanceof Error ? error.message : String(error);
            matrix.push({
              title: flow.title,
              type: 'UI / Browser',
              status: 'Skipped',
              duration: null,
              evidence: null,
              reason: `Execution planning failed: ${message}`,
              file: change.file,
            });
            continue;
          }

          executionPlans.push(executionPlan);
          pendingFlowRuns.push({ change, flow, sourceScenarios });

          const scenarioRunIndex = matrix.length;
          const sessionName = uiBrowserSessionName(input.session.id, scenarioRunIndex);
          const agentRunner = this.#agentRunner ?? this.#createAgentRunner(input, sessionName);
          const liveScreenshotHrefs = new Set<string>();
          const scenarioResult = await agentRunner.runScenario({
            baseUrl: lease.baseUrl,
            gherkinText: sourceScenarios.map(item => item.text).join('\n\n'),
            executionPlan,
            constraints: lookupRunConstraints(input.session.plan?.runConstraints, change.title),
            defaultRoute,
            signal: input.signal,
            onScreenshot: async artifact => {
              const emitted = await input.emit({ type: 'screenshot', artifact });
              if (emitted.type !== 'screenshot') return artifact;
              if (emitted.artifact.href) liveScreenshotHrefs.add(emitted.artifact.href);
              return emitted.artifact;
            },
            onProgress: message => input.emit({
              type: 'progress',
              message: `[Flow ${flow.id}] ${message}`,
              percent: Math.min(90, 78 + Math.round(((changeIndex + 0.5) / uiChanges.length) * 10)),
            }),
          });
          completedFlowRunCount += 1;

          const changeEvidence = await collectScenarioEvidence(input, scenarioResult, liveScreenshotHrefs);
          totalDuration += scenarioResult.durationMs;
          allEvidence.push(...changeEvidence);
          matrix.push({
            title: flow.title,
            type: 'UI / Browser',
            status: scenarioResult.outcome,
            duration: durationLabel(scenarioResult.durationMs),
            evidence: matrixEvidenceLabelFromItems(changeEvidence),
            evidenceItems: changeEvidence.length > 0 ? changeEvidence : undefined,
            reason: scenarioResult.reason,
            file: change.file,
          });
        }

        const trace = await buildExecutionPlanTraceEvidence({ flowPlan, executionPlans });
        if (trace) allEvidence.push(trace);
      }

      const runTrace = await buildUiBrowserRunTraceEvidence(allEvidence);
      if (runTrace) allEvidence.push(runTrace);

      return {
        result: {
          outcome: runOutcomeFromMatrix(matrix),
          durationMs: totalDuration,
          evidence: allEvidence,
        },
        targetUrl,
        matrix,
      };
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      await input.emit({
        type: 'progress',
        message: `Warning: UI Browser runner failed. ${error instanceof Error ? error.message : String(error)}`,
        percent: 80,
      });
      const rawErrorMessage = error instanceof Error ? error.message : String(error);
      const setupFailed = !targetUrl && !input.runOptions?.manualBaseUrl;
      const errorMessage = setupFailed
        ? `Could not start dev server: ${rawErrorMessage}`
        : input.runOptions?.manualBaseUrl
        ? rawErrorMessage
        : `${rawErrorMessage} Provide a running app URL to continue UI Browser tests.`;
      const rowStatus: RunOutcome = setupFailed ? 'Skipped' : 'Failed';
      for (const pending of pendingFlowRuns.slice(completedFlowRunCount)) {
        matrix.push({
          title: pending.flow.title,
          type: 'UI / Browser',
          status: rowStatus,
          duration: null,
          evidence: null,
          reason: errorMessage,
          file: pending.change.file,
        });
      }
      if (matrix.length === 0) {
        matrix.push(...uiChanges.map(change => ({
          title: change.title,
          type: 'UI / Browser' as const,
          status: rowStatus,
          duration: null,
          evidence: null,
          reason: errorMessage,
          file: change.file,
        })));
      }
      const runTrace = await buildUiBrowserRunTraceEvidence(allEvidence);
      if (runTrace) allEvidence.push(runTrace);
      return {
        result: {
          outcome: setupFailed ? 'Skipped' : 'Failed',
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

  #attentionFor(matrix: TestResultRow[]): TestRunResult['attention'] {
    const failed = matrix.find(row => row.status === 'Failed' || row.status === 'Flaky');
    if (!failed) {
      return undefined;
    }

    return {
      testTitle: failed.title,
      kind: failed.status === 'Flaky' ? 'flaky' : 'failed',
      reason: failed.reason ?? `UI Browser runner reported ${failed.status.toLowerCase()} outcome.`,
      likelyCause: failed.status === 'Flaky'
        ? 'The UI or browser automation has inconsistent timing or state.'
        : 'A Gherkin Then step was not satisfied on the live page.',
      suggestedFix: failed.status === 'Flaky'
        ? 'Review the captured trace and stabilize wait conditions before applying.'
        : 'Review the failure reason, fix selectors or assertions, and rerun.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    };
  }

  async #planFlows(
    input: AdapterInput,
    change: GeneratedChange,
    scenarios: IndexedUiScenario[],
    changeIndex: number,
    changeCount: number,
  ): Promise<UiBrowserUserFlowPlan> {
    const agentModel = new AgentModelRunner({ modelConnect: input.modelConnect });
    const skill = await input.skills.load('test-plan-ui-browser-flows');
    await input.emit({
      type: 'progress',
      message: `[Behavior ${changeIndex + 1}/${changeCount}] Reducing generated scenarios into user flows…`,
      percent: Math.min(90, 78 + Math.round(((changeIndex + 0.25) / changeCount) * 10)),
    });
    return agentModel.planUiBrowserFlows({
      profile: 'coder',
      skill,
      context: {
        change,
        gherkinText: scenarios.map(item => item.text).join('\n\n'),
        scenarios,
        intent: input.session.intent,
        repositoryEvidence: input.repository,
        resolvedPlanAnswers: input.session.approval?.answers ?? {},
      },
      signal: input.signal,
    });
  }

  async #planExecution(
    input: AdapterInput,
    flow: UiBrowserAcceptedFlow,
    sourceScenarios: IndexedUiScenario[],
    defaultRoute: string,
  ): Promise<UiBrowserExecutionPlan> {
    const agentModel = new AgentModelRunner({ modelConnect: input.modelConnect });
    const skill = await input.skills.load('test-plan-ui-browser-execution');
    const plan = await agentModel.planUiBrowserExecution({
      profile: 'coder',
      skill,
      context: {
        flow,
        sourceScenarios,
        repositoryEvidence: input.repository,
        defaultRoute,
        agentBrowserGuidance: await loadAgentBrowserCoreGuide(),
      },
      signal: input.signal,
    });
    return sanitizeExecutionPlan(plan, flow);
  }

  #createAgentRunner(input: AdapterInput, sessionName?: string): AgentRunnerLike {
    const agentModel = new AgentModelRunner({ modelConnect: input.modelConnect });
    return new UiBrowserAgentRunner({
      decideNext: async context => {
        const skill = await input.skills.load('test-run-ui-browser-agent');
        const coreGuide = await loadAgentBrowserCoreGuide();
        return agentModel.decideNext({
          profile: 'coder',
          skill: buildAgentBrowserRunSkillContent(skill, coreGuide),
          context,
          signal: input.signal,
        });
      },
      execute: sessionName ? sessionAgentExecutor(sessionName) : defaultAgentExecutor,
    });
  }
}

function uiBrowserSessionName(sessionId: string, scenarioRunIndex: number): string {
  return `guardrail-${sessionId}-${scenarioRunIndex + 1}`;
}
