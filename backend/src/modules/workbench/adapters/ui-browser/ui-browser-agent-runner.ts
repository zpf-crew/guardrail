import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  BehaviorRunConstraints,
  Evidence,
  RunOutcome,
  ScenarioRunResult,
} from '../../workbench.types.js';
import type { UiBrowserAgentAction, UiBrowserExecutionPlan, UiBrowserScenarioPlan } from '../../validation/workbench-validators.js';
import { parseGherkinSteps, scenarioTitleFromGherkin, type GherkinStep } from './gherkin-step-parser.js';
import {
  buildAgentIterationContext,
  formatActionForHistory,
  formatActionForProgress,
  type AgentActionHistoryEntry,
  type AgentIterationContext,
} from './ui-browser-agent-context.js';
import {
  assertSameOriginUrl,
  isAgentBrowserCommandAction,
  shouldVerifySameOriginAfterCommand,
  validateAgentBrowserCommand,
  type AgentBrowserCommandAction,
} from './agent-browser-command-policy.js';
import {
  agentCommandArgs,
  captureSnapshot,
  executeAgentAction,
  type AgentExecutor,
} from './ui-browser-agent-executor.js';
import { screenshotEvidence, screenshotPathFromStdout } from './ui-browser-evidence.js';

export interface UiBrowserAgentRunnerDeps {
  decideNext: (context: AgentIterationContext) => Promise<UiBrowserAgentAction>;
  execute: AgentExecutor;
}

export interface RunScenarioArgs {
  baseUrl: string;
  gherkinText: string;
  constraints: BehaviorRunConstraints;
  defaultRoute: string;
  scenarioPlan?: UiBrowserScenarioPlan;
  executionPlan?: UiBrowserExecutionPlan;
  signal: AbortSignal;
  onScreenshot?: (evidence: Evidence) => Promise<Evidence>;
  onProgress?: (message: string) => void;
  onThinking?: (message: string) => void;
  onDebug?: (message: string) => void;
}

export class UiBrowserAgentRunner {
  readonly #decideNext: (context: AgentIterationContext) => Promise<UiBrowserAgentAction>;
  readonly #execute: AgentExecutor;

  constructor(deps: UiBrowserAgentRunnerDeps) {
    this.#decideNext = deps.decideNext;
    this.#execute = deps.execute;
  }

  async runScenario(args: RunScenarioArgs): Promise<ScenarioRunResult> {
    const steps = args.executionPlan
      ? stepsFromExecutionPlan(args.executionPlan)
      : args.scenarioPlan
        ? stepsFromScenarioPlan(args.scenarioPlan)
        : parseGherkinSteps(args.gherkinText);
    const title = args.executionPlan?.title ?? args.scenarioPlan?.title ?? scenarioTitleFromGherkin(args.gherkinText);
    let currentStepIndex = 0;
    let iterationsUsed = 0;
    const startedAt = Date.now();
    let currentStepActiveMs = 0;
    const completedSteps: Array<{ index: number; note: string }> = [];
    const thenVerdicts: ScenarioRunResult['thenVerdicts'] = [];
    const actionHistory: AgentActionHistoryEntry[] = [];
    const evidence: Evidence[] = [];
    const trace: UiBrowserTraceEvent[] = [];
    let primaryActionCompletedForStep = false;
    let primaryActionCommandForStep: string | null = null;
    let observationOnlyActionsForCurrentStep = 0;

    trace.push({
      atMs: 0,
      type: 'source',
      gherkinText: args.gherkinText,
    });
    if (args.scenarioPlan) {
      trace.push({
        atMs: 0,
        type: 'plan',
        plan: args.scenarioPlan,
      });
    }
    if (args.executionPlan) {
      trace.push({
        atMs: 0,
        type: 'execution-plan',
        plan: args.executionPlan,
      });
    }

    const initialOpenArgs = ['open', new URL(args.defaultRoute || '/', args.baseUrl).toString()];
    const initialOpen = await this.#execute(initialOpenArgs, args.signal);
    args.onDebug?.(commandDebugLine('initial-open', initialOpenArgs, initialOpen));
    trace.push({
      atMs: Date.now() - startedAt,
      type: 'command',
      command: initialOpenArgs,
      exitCode: initialOpen.exitCode,
      stdout: initialOpen.stdout,
      stderr: initialOpen.stderr,
    });
    if (initialOpen.exitCode !== 0) {
      return finishScenario({
        outcome: 'Failed',
        durationMs: Date.now() - startedAt,
        evidence,
        thenVerdicts,
        reason: `agent-browser initial navigation failed: ${initialOpen.stderr || initialOpen.stdout || `exit ${initialOpen.exitCode}`}`,
        iterationsUsed,
        constraintsApplied: args.constraints,
      }, trace, evidence);
    }

    const fail = async (
      reason: string,
      outcome: RunOutcome = 'Failed',
      screenshotLabel?: string,
    ): Promise<ScenarioRunResult> => {
      trace.push({
        atMs: Date.now() - startedAt,
        type: 'failure',
        reason,
      });
      const diagnostics = await captureBrowserDiagnostics(
        this.#execute,
        args.signal,
        `failure diagnostics — ${truncateDetail(reason, 80)}`,
        args.onDebug,
      );
      if (diagnostics) evidence.push(diagnostics);
      const screenshot = await captureScreenshotEvidence(
        this.#execute,
        args.signal,
        screenshotLabel ?? truncateLabel(reason),
        args.onDebug,
      );
      if (screenshot) {
        evidence.push(await emitScreenshot(screenshot, args.onScreenshot));
      }
      return finishScenario({
        outcome,
        durationMs: Date.now() - startedAt,
        evidence,
        thenVerdicts,
        reason,
        iterationsUsed,
        constraintsApplied: args.constraints,
      }, trace, evidence);
    };

    while (true) {
      args.signal.throwIfAborted();
      if (iterationsUsed >= args.constraints.maxSteps) {
        return fail(`Exceeded max ${args.constraints.maxSteps} agent steps`);
      }
      if (currentStepActiveMs >= args.constraints.maxStepDurationMs) {
        return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
      }

      const snapshotStartedAt = Date.now();
      const snapshot = await captureSnapshot(this.#execute, args.signal);
      currentStepActiveMs += Date.now() - snapshotStartedAt;
      args.onDebug?.(`snapshot iteration=${iterationsUsed + 1} step=${currentStepIndex} exit=${snapshot.exitCode} stdoutChars=${snapshot.stdout.length} stderr=${debugExcerpt(snapshot.stderr)}`);
      if (iterationsUsed === 0) {
        await captureBrowserDiagnostics(this.#execute, args.signal, 'after initial snapshot', args.onDebug);
      }
      trace.push({
        atMs: Date.now() - startedAt,
        type: 'snapshot',
        exitCode: snapshot.exitCode,
        stdout: snapshot.stdout,
        stderr: snapshot.stderr,
      });
      if (snapshot.exitCode !== 0) {
        return fail(`agent-browser snapshot failed: ${snapshot.stderr || snapshot.stdout}`);
      }
      if (currentStepActiveMs >= args.constraints.maxStepDurationMs) {
        return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
      }

      iterationsUsed += 1;
      const currentStep = steps[currentStepIndex];
      const context = buildAgentIterationContext({
        scenarioTitle: title,
        gherkinSteps: steps,
        currentStepIndex,
        completedSteps,
        thenVerdicts,
        pageSnapshot: snapshot.stdout,
        actionHistory,
        constraints: args.constraints,
        startedAt,
        iterationsUsed,
        observationOnlyActionsForCurrentStep,
      });

      args.onThinking?.('Reading page and planning next action…');

      let action: UiBrowserAgentAction;
      try {
        action = await this.#decideNext(context);
      } catch (error) {
        const reason = `Agent decision failed: ${error instanceof Error ? error.message : String(error)}`;
        trace.push({
          atMs: Date.now() - startedAt,
          type: 'decision-error',
          iteration: iterationsUsed,
          currentStepIndex,
          reason,
        });
        return fail(reason);
      }
      args.onDebug?.(`decision iteration=${iterationsUsed} step=${currentStepIndex} action=${formatActionForHistory(action)}`);
      trace.push({
        atMs: Date.now() - startedAt,
        type: 'decision',
        iteration: iterationsUsed,
        currentStepIndex,
        action,
      });

      const contractFailure = actionContractFailure(context, action);
      if (contractFailure) {
        trace.push({
          atMs: Date.now() - startedAt,
          type: 'command-rejected',
          iteration: iterationsUsed,
          currentStepIndex,
          action,
          reason: contractFailure,
        });
        return fail(contractFailure);
      }

      if (isAgentBrowserCommandAction(action)) {
        try {
          validateAgentBrowserCommand(action);
        } catch (error) {
          const reason = `agent-browser command rejected: ${error instanceof Error ? error.message : String(error)}`;
          trace.push({
            atMs: Date.now() - startedAt,
            type: 'command-rejected',
            iteration: iterationsUsed,
            currentStepIndex,
            action,
            reason,
          });
          return fail(reason);
        }
      }

      if (shouldAutoCompleteActionStep(currentStep?.effectiveKind, action, primaryActionCompletedForStep)) {
        const note = `Completed after successful browser action; skipped extra ${action.command} evidence gathering for this ${currentStep?.effectiveKind} step.`;
        args.onProgress?.(formatActionForProgress({ kind: 'stepComplete', stepIndex: currentStepIndex, note }, steps, currentStepIndex));
        actionHistory.push({
          iteration: iterationsUsed,
          action: `stepComplete ${currentStepIndex}`,
          result: 'ok',
          detail: note,
        });
        const nextStepIndex = Math.min(currentStepIndex + 1, Math.max(steps.length - 1, 0));
        const observationCarriesToNextThen = steps[nextStepIndex]?.effectiveKind === 'Then';
        completedSteps.push({ index: currentStepIndex, note });
        currentStepIndex = nextStepIndex;
        currentStepActiveMs = 0;
        primaryActionCompletedForStep = false;
        primaryActionCommandForStep = null;
        observationOnlyActionsForCurrentStep = observationCarriesToNextThen ? 1 : 0;
        continue;
      }

      if (shouldAutoCompleteDuplicatePrimaryAction(currentStep?.effectiveKind, action, primaryActionCommandForStep)) {
        const note = `Completed after successful ${primaryActionCommandForStep} action; skipped duplicate ${primaryActionCommandForStep} for this ${currentStep?.effectiveKind} step.`;
        args.onProgress?.(formatActionForProgress({ kind: 'stepComplete', stepIndex: currentStepIndex, note }, steps, currentStepIndex));
        actionHistory.push({
          iteration: iterationsUsed,
          action: `stepComplete ${currentStepIndex}`,
          result: 'ok',
          detail: note,
        });
        completedSteps.push({ index: currentStepIndex, note });
        currentStepIndex = Math.min(currentStepIndex + 1, Math.max(steps.length - 1, 0));
        currentStepActiveMs = 0;
        primaryActionCompletedForStep = false;
        primaryActionCommandForStep = null;
        observationOnlyActionsForCurrentStep = 0;
        continue;
      }

      if (
        currentStep?.effectiveKind === 'Then'
        && isAgentBrowserCommandAction(action)
        && isMutatingCommand(action)
      ) {
        return fail(`Mutating browser command is not allowed during assert step: ${formatActionForHistory(action)}`);
      }

      args.onProgress?.(formatActionForProgress(action, steps, currentStepIndex));

      if (action.kind === 'scenarioComplete') {
        const pendingThen = steps.filter(
          (step, index) => step.effectiveKind === 'Then'
            && !thenVerdicts.some(verdict => verdict.stepIndex === index && verdict.satisfied),
        );
        if (pendingThen.length > 0) {
          return fail('scenarioComplete called before all Then steps satisfied');
        }
        return finishScenario({
          outcome: 'Passed',
          durationMs: Date.now() - startedAt,
          evidence,
          thenVerdicts,
          reason: null,
          iterationsUsed,
          constraintsApplied: args.constraints,
        }, trace, evidence);
      }

      if (action.kind === 'stepComplete') {
        if (action.stepIndex !== currentStepIndex) {
          return fail(`stepComplete index mismatch: expected ${currentStepIndex}, got ${action.stepIndex}`);
        }
        completedSteps.push({ index: action.stepIndex, note: action.note });
        currentStepIndex = Math.min(currentStepIndex + 1, Math.max(steps.length - 1, 0));
        currentStepActiveMs = 0;
        primaryActionCompletedForStep = false;
        primaryActionCommandForStep = null;
        observationOnlyActionsForCurrentStep = 0;
        continue;
      }

      if (action.kind === 'assertThen') {
        const step = steps[action.stepIndex];
        if (!step || step.effectiveKind !== 'Then') {
          return fail(`assertThen targeted non-Then step ${action.stepIndex}`);
        }
        thenVerdicts.push({
          stepIndex: action.stepIndex,
          text: step.text,
          satisfied: action.satisfied,
          reason: action.reason,
        });
        if (!action.satisfied) {
          return fail(action.reason, 'Failed', `Failed check — ${step.text}`);
        }
        const screenshot = await captureScreenshotEvidence(
          this.#execute,
          args.signal,
          `Verified — ${step.text}`,
          args.onDebug,
        );
        if (screenshot) {
          evidence.push(await emitScreenshot(screenshot, args.onScreenshot));
        }
        if (allThenStepsSatisfied(steps, thenVerdicts)) {
          return finishScenario({
            outcome: 'Passed',
            durationMs: Date.now() - startedAt,
            evidence,
            thenVerdicts,
            reason: null,
            iterationsUsed,
            constraintsApplied: args.constraints,
          }, trace, evidence);
        }
        currentStepIndex = Math.min(action.stepIndex + 1, Math.max(steps.length - 1, 0));
        currentStepActiveMs = 0;
        primaryActionCompletedForStep = false;
        primaryActionCommandForStep = null;
        observationOnlyActionsForCurrentStep = 0;
        continue;
      }

      if (action.kind === 'stepFailed') {
        return fail(action.reason);
      }

      const browserAction = action as AgentBrowserCommandAction;
      let result: Awaited<ReturnType<typeof executeAgentAction>>;
      let commandArgs: string[] | null = null;
      try {
        commandArgs = agentCommandArgs(args.baseUrl, action);
        const ref = refToScrollIntoViewBeforeAction(browserAction);
        if (ref) {
          const scrollStartedAt = Date.now();
          const scrollResult = await this.#execute(['scrollintoview', ref], args.signal);
          currentStepActiveMs += Date.now() - scrollStartedAt;
          args.onDebug?.(commandDebugLine('scrollintoview', ['scrollintoview', ref], scrollResult));
          trace.push({
            atMs: Date.now() - startedAt,
            type: 'command',
            iteration: iterationsUsed,
            currentStepIndex,
            action,
            command: ['scrollintoview', ref],
            exitCode: scrollResult.exitCode,
            stdout: scrollResult.stdout,
            stderr: scrollResult.stderr,
          });
          if (scrollResult.exitCode !== 0) {
            return fail(`agent-browser scrollintoview failed before ${formatActionForHistory(action)}: ${scrollResult.stderr || scrollResult.stdout || `exit ${scrollResult.exitCode}`}`);
          }
          if (currentStepActiveMs >= args.constraints.maxStepDurationMs) {
            return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
          }
        }
        const commandStartedAt = Date.now();
        result = await executeAgentAction(args.baseUrl, action, this.#execute, args.signal);
        currentStepActiveMs += Date.now() - commandStartedAt;
      } catch (error) {
        const reason = `agent-browser command rejected: ${error instanceof Error ? error.message : String(error)}`;
        trace.push({
          atMs: Date.now() - startedAt,
          type: 'command-rejected',
          iteration: iterationsUsed,
          currentStepIndex,
          action,
          reason,
        });
        return fail(reason);
      }
      if (result) {
        args.onDebug?.(commandDebugLine('command', commandArgs ?? [], result));
        trace.push({
          atMs: Date.now() - startedAt,
          type: 'command',
          iteration: iterationsUsed,
          currentStepIndex,
          action,
          command: commandArgs ?? [],
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }
      if (result && result.exitCode !== 0) {
        const detail = truncateDetail(result.stderr || result.stdout || `exit ${result.exitCode}`);
        args.onProgress?.(`Browser action failed — ${formatActionForHistory(action)}: ${detail}`);
        actionHistory.push({
          iteration: iterationsUsed,
          action: formatActionForHistory(action),
          result: 'failed',
          detail,
        });
        continue;
      }
      if (currentStepActiveMs >= args.constraints.maxStepDurationMs) {
        return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
      }

      if (result) {
        const originCheckStartedAt = Date.now();
        const originError = await verifySameOriginAfterCommand(args.baseUrl, browserAction, this.#execute, args.signal);
        currentStepActiveMs += Date.now() - originCheckStartedAt;
        args.onDebug?.(`origin-check iteration=${iterationsUsed} step=${currentStepIndex} ok=${!originError}${originError ? ` reason=${debugExcerpt(originError)}` : ''}`);
        trace.push({
          atMs: Date.now() - startedAt,
          type: 'origin-check',
          iteration: iterationsUsed,
          currentStepIndex,
          action,
          ok: !originError,
          ...(originError ? { reason: originError } : {}),
        });
        if (originError) return fail(originError);
        if (currentStepActiveMs >= args.constraints.maxStepDurationMs) {
          return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
        }
      }
      if (result && isPrimaryActionCommand(browserAction)) {
        primaryActionCompletedForStep = true;
        primaryActionCommandForStep = browserAction.command;
      }
      if (result && isObservationOnlyCommand(browserAction)) {
        observationOnlyActionsForCurrentStep += 1;
      }

      const successDetail = result && shouldKeepCommandOutput(action)
        ? truncateDetail(result.stdout || result.stderr || `exit ${result.exitCode}`)
        : undefined;

      actionHistory.push({
        iteration: iterationsUsed,
        action: formatActionForHistory(action),
        result: 'ok',
        ...(successDetail ? { detail: successDetail } : {}),
      });

      if (browserAction.command === 'screenshot' && result) {
        const screenshot = screenshotEvidence(browserAction.reason, screenshotPathFromStdout(result.stdout));
        evidence.push(await emitScreenshot(screenshot, args.onScreenshot));
      }
    }
  }
}

type UiBrowserTraceEvent =
  | {
    atMs: number;
    type: 'source';
    gherkinText: string;
  }
  | {
    atMs: number;
    type: 'plan';
    plan: UiBrowserScenarioPlan;
  }
  | {
    atMs: number;
    type: 'execution-plan';
    plan: UiBrowserExecutionPlan;
  }
  | {
    atMs: number;
    type: 'snapshot';
    exitCode: number;
    stdout: string;
    stderr: string;
  }
  | {
    atMs: number;
    type: 'decision';
    iteration: number;
    currentStepIndex: number;
    action: UiBrowserAgentAction;
  }
  | {
    atMs: number;
    type: 'decision-error' | 'command-rejected';
    iteration: number;
    currentStepIndex: number;
    action?: UiBrowserAgentAction;
    reason: string;
  }
  | {
    atMs: number;
    type: 'command';
    iteration?: number;
    currentStepIndex?: number;
    action?: UiBrowserAgentAction;
    command: string[];
    exitCode: number;
    stdout: string;
    stderr: string;
  }
  | {
    atMs: number;
    type: 'origin-check';
    iteration: number;
    currentStepIndex: number;
    action: UiBrowserAgentAction;
    ok: boolean;
    reason?: string;
  }
  | {
    atMs: number;
    type: 'failure';
    reason: string;
  };

async function finishScenario(
  result: ScenarioRunResult,
  trace: UiBrowserTraceEvent[],
  evidence: Evidence[],
): Promise<ScenarioRunResult> {
  const traceEvidence = await writeUiBrowserTraceEvidence({
    outcome: result.outcome,
    reason: result.reason,
    durationMs: result.durationMs,
    iterationsUsed: result.iterationsUsed,
    constraintsApplied: result.constraintsApplied,
    thenVerdicts: result.thenVerdicts,
    events: trace,
  });
  if (traceEvidence) evidence.push(traceEvidence);
  return {
    ...result,
    evidence,
  };
}

async function writeUiBrowserTraceEvidence(payload: unknown): Promise<Evidence | null> {
  try {
    const dir = path.join(os.tmpdir(), 'guardrail-ui-browser-traces');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${randomUUID()}.json`);
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return { kind: 'trace', label: 'UI Browser raw trace', href: filePath };
  } catch {
    return null;
  }
}

async function captureScreenshotEvidence(
  execute: AgentExecutor,
  signal: AbortSignal,
  label: string,
  debug?: (message: string) => void,
): Promise<Evidence | null> {
  try {
    const result = await execute(['screenshot'], signal);
    const href = screenshotPathFromStdout(result.stdout);
    const fileSize = href ? await stat(href).then(info => info.size).catch(() => null) : null;
    debug?.(`screenshot-capture exit=${result.exitCode} href=${href ?? '<none>'} size=${fileSize ?? '<unknown>'} stdout=${debugExcerpt(result.stdout)} stderr=${debugExcerpt(result.stderr)}`);
    if (result.exitCode !== 0) return null;
    if (!href) return null;
    return screenshotEvidence(label, href);
  } catch (error) {
    debug?.(`screenshot-capture error=${error instanceof Error ? error.message : String(error)}`);
    // Best-effort evidence on failure.
    return null;
  }
}

async function captureBrowserDiagnostics(
  execute: AgentExecutor,
  signal: AbortSignal,
  label: string,
  debug?: (message: string) => void,
): Promise<Evidence | null> {
  try {
    const [url, bodyText, rootHtml, consoleOutput, errors, networkRequests] = await Promise.all([
      execute(['get', 'url'], signal).catch(errorResult),
      execute(['get', 'text', 'body'], signal).catch(errorResult),
      execute(['get', 'html', '#root'], signal).catch(errorResult),
      execute(['console'], signal).catch(errorResult),
      execute(['errors'], signal).catch(errorResult),
      execute(['network', 'requests'], signal).catch(errorResult),
    ]);

    debug?.(`diagnostics ${label} url=${debugExcerpt(url.stdout || url.stderr)} bodyText=${diagnosticSummary(bodyText)} rootHtml=${diagnosticSummary(rootHtml)} console=${diagnosticSummary(consoleOutput)} errors=${diagnosticSummary(errors)} network=${diagnosticSummary(networkRequests)}`);

    const dir = path.join(os.tmpdir(), 'guardrail-ui-browser-diagnostics');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${randomUUID()}.json`);
    await writeFile(
      filePath,
      `${JSON.stringify({
        kind: 'ui-browser-diagnostics',
        label,
        capturedAt: new Date().toISOString(),
        url,
        bodyText,
        rootHtml,
        console: consoleOutput,
        errors,
        networkRequests,
      }, null, 2)}\n`,
      'utf8',
    );
    return { kind: 'trace', label: `UI Browser ${label}`, href: filePath };
  } catch (error) {
    debug?.(`diagnostics ${label} error=${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function errorResult(error: unknown): { exitCode: number; stdout: string; stderr: string } {
  return {
    exitCode: 1,
    stdout: '',
    stderr: error instanceof Error ? error.message : String(error),
  };
}

async function emitScreenshot(
  evidence: Evidence,
  onScreenshot: RunScenarioArgs['onScreenshot'],
): Promise<Evidence> {
  return onScreenshot ? onScreenshot(evidence) : evidence;
}

function truncateLabel(value: string, max = 72): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return `Failure — ${trimmed}`;
  return `Failure — ${trimmed.slice(0, max - 1)}…`;
}

function stepTimeoutReason(
  steps: ReturnType<typeof parseGherkinSteps>,
  stepIndex: number,
  maxStepDurationMs: number,
): string {
  const step = steps[stepIndex];
  if (!step) return `Exceeded max step duration (${maxStepDurationMs}ms)`;
  return `Exceeded max step duration (${maxStepDurationMs}ms) on step ${stepIndex + 1}/${steps.length}: ${step.effectiveKind} ${step.text}`;
}

function stepsFromScenarioPlan(plan: UiBrowserScenarioPlan): GherkinStep[] {
  return plan.steps.map((step, index) => {
    const effectiveKind = step.kind === 'assert' ? 'Then' : step.kind === 'setup' ? 'Given' : 'When';
    const text = step.successCriteria
      ? `${step.instruction} (${step.successCriteria})`
      : step.instruction;
    return {
      index,
      kind: effectiveKind,
      effectiveKind,
      text,
    };
  });
}

function stepsFromExecutionPlan(plan: UiBrowserExecutionPlan): GherkinStep[] {
  return plan.steps.map((step, index) => {
    const effectiveKind = step.kind === 'assert' ? 'Then' : step.kind === 'setup' ? 'Given' : 'When';
    return {
      index,
      kind: effectiveKind,
      effectiveKind,
      text: `${step.instruction} (${step.successCriteria})`,
    };
  });
}

function truncateDetail(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function debugExcerpt(value: string | undefined, max = 220): string {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '<empty>';
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function commandDebugLine(
  phase: string,
  command: string[],
  result: { exitCode: number; stdout: string; stderr: string },
): string {
  return `${phase} command=${command.join(' ')} exit=${result.exitCode} stdout=${debugExcerpt(result.stdout)} stderr=${debugExcerpt(result.stderr)}`;
}

function diagnosticSummary(result: { exitCode: number; stdout: string; stderr: string }): string {
  const content = result.stdout || result.stderr;
  const lineCount = content.trim() ? content.trim().split(/\r?\n/).length : 0;
  return `exit=${result.exitCode} lines=${lineCount} ${debugExcerpt(content, 140)}`;
}

function shouldKeepCommandOutput(action: UiBrowserAgentAction): boolean {
  return action.kind === 'agentBrowserCommand'
    && ['get', 'is', 'find'].includes(action.command);
}

function allThenStepsSatisfied(
  steps: ReturnType<typeof parseGherkinSteps>,
  thenVerdicts: ScenarioRunResult['thenVerdicts'],
): boolean {
  const thenIndexes = steps
    .map((step, index) => step.effectiveKind === 'Then' ? index : null)
    .filter((index): index is number => index !== null);
  return thenIndexes.length > 0
    && thenIndexes.every(index => thenVerdicts.some(verdict => verdict.stepIndex === index && verdict.satisfied));
}

function shouldAutoCompleteActionStep(
  effectiveKind: string | undefined,
  action: UiBrowserAgentAction,
  primaryActionCompletedForStep: boolean,
): action is UiBrowserAgentAction & AgentBrowserCommandAction {
  return primaryActionCompletedForStep
    && (effectiveKind === 'Given' || effectiveKind === 'When')
    && isAgentBrowserCommandAction(action)
    && isObservationOnlyCommand(action);
}

function shouldAutoCompleteDuplicatePrimaryAction(
  effectiveKind: string | undefined,
  action: UiBrowserAgentAction,
  primaryActionCommandForStep: string | null,
): action is UiBrowserAgentAction & AgentBrowserCommandAction {
  return (effectiveKind === 'Given' || effectiveKind === 'When')
    && primaryActionCommandForStep !== null
    && isAgentBrowserCommandAction(action)
    && isPrimaryActionCommand(action)
    && action.command === primaryActionCommandForStep;
}

function isMutatingCommand(action: AgentBrowserCommandAction): boolean {
  return isPrimaryActionCommand(action)
    || ['open', 'go', 'reload', 'back', 'forward'].includes(action.command);
}

function actionContractFailure(context: AgentIterationContext, action: UiBrowserAgentAction): string | null {
  if (!context.allowedActionKinds.includes(action.kind)) {
    if (context.currentStep.verdictRequiredNow) {
      return `Verdict required now for Then step after observation; return assertThen or stepFailed, not ${formatActionForHistory(action)}.`;
    }
    return `Action kind ${action.kind} is not allowed for current step; allowed kinds: ${context.allowedActionKinds.join(', ')}.`;
  }
  if (isAgentBrowserCommandAction(action) && !context.allowedCommands.includes(action.command)) {
    if (context.currentStep.verdictRequiredNow) {
      return `Verdict required now for Then step after observation; return assertThen or stepFailed, not ${formatActionForHistory(action)}.`;
    }
    return `agent-browser command ${action.command} is not allowed for current step; allowed commands: ${context.allowedCommands.join(', ') || 'none'}.`;
  }
  return null;
}

function isPrimaryActionCommand(action: AgentBrowserCommandAction): boolean {
  if (['click', 'dblclick', 'fill', 'type', 'press', 'check', 'uncheck', 'select', 'keyboard'].includes(action.command)) {
    return true;
  }
  return action.command === 'find' && action.args.some(arg => ['click', 'dblclick', 'fill', 'type', 'check', 'uncheck'].includes(arg));
}

function refToScrollIntoViewBeforeAction(action: AgentBrowserCommandAction): string | null {
  if (!['click', 'dblclick', 'fill', 'type', 'check', 'uncheck', 'select'].includes(action.command)) {
    return null;
  }
  const ref = action.args[0];
  return ref && /^@e\d+$/.test(ref) ? ref : null;
}

function isObservationOnlyCommand(action: AgentBrowserCommandAction): boolean {
  return ['snapshot', 'screenshot', 'get', 'is'].includes(action.command);
}

async function verifySameOriginAfterCommand(
  baseUrl: string,
  action: AgentBrowserCommandAction,
  execute: AgentExecutor,
  signal: AbortSignal,
): Promise<string | null> {
  if (!shouldVerifySameOriginAfterCommand(action)) return null;
  const result = await execute(['get', 'url'], signal);
  if (result.exitCode !== 0) {
    return `agent-browser origin check failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`;
  }
  try {
    assertSameOriginUrl(baseUrl, result.stdout);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
