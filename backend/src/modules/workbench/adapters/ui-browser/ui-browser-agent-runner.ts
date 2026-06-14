import type {
  BehaviorRunConstraints,
  Evidence,
  RunOutcome,
  ScenarioRunResult,
} from '../../workbench.types.js';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';
import { parseGherkinSteps, scenarioTitleFromGherkin } from './gherkin-step-parser.js';
import {
  buildAgentIterationContext,
  formatActionForHistory,
  formatActionForProgress,
  type AgentActionHistoryEntry,
  type AgentIterationContext,
} from './ui-browser-agent-context.js';
import {
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
  signal: AbortSignal;
  onScreenshot?: (evidence: Evidence) => Promise<Evidence>;
  onProgress?: (message: string) => void;
  onThinking?: (message: string) => void;
}

export class UiBrowserAgentRunner {
  readonly #decideNext: (context: AgentIterationContext) => Promise<UiBrowserAgentAction>;
  readonly #execute: AgentExecutor;

  constructor(deps: UiBrowserAgentRunnerDeps) {
    this.#decideNext = deps.decideNext;
    this.#execute = deps.execute;
  }

  async runScenario(args: RunScenarioArgs): Promise<ScenarioRunResult> {
    const steps = parseGherkinSteps(args.gherkinText);
    const title = scenarioTitleFromGherkin(args.gherkinText);
    let currentStepIndex = 0;
    let iterationsUsed = 0;
    const startedAt = Date.now();
    let currentStepStartedAt = startedAt;
    const completedSteps: Array<{ index: number; note: string }> = [];
    const thenVerdicts: ScenarioRunResult['thenVerdicts'] = [];
    const actionHistory: AgentActionHistoryEntry[] = [];
    const evidence: Evidence[] = [];

    const fail = async (
      reason: string,
      outcome: RunOutcome = 'Failed',
      screenshotLabel?: string,
    ): Promise<ScenarioRunResult> => {
      const screenshot = await captureScreenshotEvidence(
        this.#execute,
        args.signal,
        screenshotLabel ?? truncateLabel(reason),
      );
      if (screenshot) {
        evidence.push(await emitScreenshot(screenshot, args.onScreenshot));
      }
      return {
        outcome,
        durationMs: Date.now() - startedAt,
        evidence,
        thenVerdicts,
        reason,
        iterationsUsed,
        constraintsApplied: args.constraints,
      };
    };

    while (true) {
      args.signal.throwIfAborted();
      if (iterationsUsed >= args.constraints.maxSteps) {
        return fail(`Exceeded max ${args.constraints.maxSteps} agent steps`);
      }
      if (Date.now() - currentStepStartedAt >= args.constraints.maxStepDurationMs) {
        return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
      }

      const snapshot = await captureSnapshot(this.#execute, args.signal);
      if (snapshot.exitCode !== 0) {
        return fail(`agent-browser snapshot failed: ${snapshot.stderr || snapshot.stdout}`);
      }

      iterationsUsed += 1;
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
      });

      args.onThinking?.('Reading page and planning next action…');

      let action: UiBrowserAgentAction;
      try {
        action = await this.#decideNext(context);
      } catch (error) {
        return fail(`Agent decision failed: ${error instanceof Error ? error.message : String(error)}`);
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
        return {
          outcome: 'Passed',
          durationMs: Date.now() - startedAt,
          evidence,
          thenVerdicts,
          reason: null,
          iterationsUsed,
          constraintsApplied: args.constraints,
        };
      }

      if (action.kind === 'stepComplete') {
        if (Date.now() - currentStepStartedAt >= args.constraints.maxStepDurationMs) {
          return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
        }
        if (action.stepIndex !== currentStepIndex) {
          return fail(`stepComplete index mismatch: expected ${currentStepIndex}, got ${action.stepIndex}`);
        }
        completedSteps.push({ index: action.stepIndex, note: action.note });
        currentStepIndex = Math.min(currentStepIndex + 1, Math.max(steps.length - 1, 0));
        currentStepStartedAt = Date.now();
        continue;
      }

      if (action.kind === 'assertThen') {
        if (Date.now() - currentStepStartedAt >= args.constraints.maxStepDurationMs) {
          return fail(stepTimeoutReason(steps, currentStepIndex, args.constraints.maxStepDurationMs));
        }
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
        currentStepIndex = Math.min(action.stepIndex + 1, Math.max(steps.length - 1, 0));
        currentStepStartedAt = Date.now();
        continue;
      }

      if (action.kind === 'stepFailed') {
        return fail(action.reason);
      }

      let result: Awaited<ReturnType<typeof executeAgentAction>>;
      try {
        result = await executeAgentAction(args.baseUrl, action, this.#execute, args.signal);
      } catch (error) {
        return fail(`agent-browser command rejected: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (result && result.exitCode !== 0) {
        const detail = result.stderr || result.stdout || `exit ${result.exitCode}`;
        args.onProgress?.(`Browser action failed — ${formatActionForHistory(action)}: ${truncateDetail(detail)}`);
        actionHistory.push({
          iteration: iterationsUsed,
          action: formatActionForHistory(action),
          result: 'failed',
          detail,
        });
        continue;
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

      if (action.kind === 'agentBrowserCommand' && action.command === 'screenshot' && result) {
        const screenshot = screenshotEvidence(action.reason, screenshotPathFromStdout(result.stdout));
        evidence.push(await emitScreenshot(screenshot, args.onScreenshot));
      }
    }
  }
}

async function captureScreenshotEvidence(
  execute: AgentExecutor,
  signal: AbortSignal,
  label: string,
): Promise<Evidence | null> {
  try {
    const result = await execute(['screenshot'], signal);
    if (result.exitCode !== 0) return null;
    const href = screenshotPathFromStdout(result.stdout);
    if (!href) return null;
    return screenshotEvidence(label, href);
  } catch {
    // Best-effort evidence on failure.
    return null;
  }
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

function truncateDetail(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function shouldKeepCommandOutput(action: UiBrowserAgentAction): boolean {
  return action.kind === 'agentBrowserCommand'
    && ['get', 'is', 'find'].includes(action.command);
}
