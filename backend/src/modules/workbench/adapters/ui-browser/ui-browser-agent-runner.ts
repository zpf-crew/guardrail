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
    const completedSteps: Array<{ index: number; note: string }> = [];
    const thenVerdicts: ScenarioRunResult['thenVerdicts'] = [];
    const actionHistory: AgentActionHistoryEntry[] = [];
    const evidence: Evidence[] = [];

    const fail = (reason: string, outcome: RunOutcome = 'Failed'): ScenarioRunResult => ({
      outcome,
      durationMs: Date.now() - startedAt,
      evidence,
      thenVerdicts,
      reason,
      iterationsUsed,
      constraintsApplied: args.constraints,
    });

    while (true) {
      args.signal.throwIfAborted();
      if (iterationsUsed >= args.constraints.maxSteps) {
        return fail(`Exceeded max ${args.constraints.maxSteps} agent steps`);
      }
      if (Date.now() - startedAt >= args.constraints.maxDurationMs) {
        return fail(`Exceeded max duration (${args.constraints.maxDurationMs}ms)`);
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

      let action: UiBrowserAgentAction;
      try {
        action = await this.#decideNext(context);
      } catch (error) {
        return fail(`Agent decision failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      args.onProgress?.(`Iteration ${iterationsUsed}: ${formatActionForHistory(action)}`);

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
        if (action.stepIndex !== currentStepIndex) {
          return fail(`stepComplete index mismatch: expected ${currentStepIndex}, got ${action.stepIndex}`);
        }
        completedSteps.push({ index: action.stepIndex, note: action.note });
        currentStepIndex = Math.min(currentStepIndex + 1, Math.max(steps.length - 1, 0));
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
          return fail(action.reason);
        }
        currentStepIndex = Math.min(action.stepIndex + 1, Math.max(steps.length - 1, 0));
        continue;
      }

      if (action.kind === 'stepFailed') {
        return fail(action.reason);
      }

      const result = await executeAgentAction(args.baseUrl, action, this.#execute, args.signal);
      if (result && result.exitCode !== 0) {
        actionHistory.push({
          iteration: iterationsUsed,
          action: formatActionForHistory(action),
          result: 'failed',
          detail: result.stderr || result.stdout,
        });
        continue;
      }

      actionHistory.push({
        iteration: iterationsUsed,
        action: formatActionForHistory(action),
        result: 'ok',
      });

      if (action.kind === 'screenshot' && result) {
        evidence.push(screenshotEvidence(action.label, screenshotPathFromStdout(result.stdout)));
      }
    }
  }
}
