import type { BehaviorRunConstraints, ThenVerdict } from '../../workbench.types.js';
import type { GherkinStep } from './gherkin-step-parser.js';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

export interface AgentActionHistoryEntry {
  iteration: number;
  action: string;
  result: 'ok' | 'failed';
  detail?: string;
}

export interface AgentIterationContext {
  scenarioTitle: string;
  gherkinSteps: GherkinStep[];
  currentStepIndex: number;
  completedSteps: Array<{ index: number; note: string }>;
  thenVerdicts: ThenVerdict[];
  pageSnapshot: string;
  actionHistory: AgentActionHistoryEntry[];
  constraints: BehaviorRunConstraints;
  elapsedMs: number;
  iterationsUsed: number;
}

export function buildAgentIterationContext(input: {
  scenarioTitle: string;
  gherkinSteps: GherkinStep[];
  currentStepIndex: number;
  completedSteps: Array<{ index: number; note: string }>;
  thenVerdicts: ThenVerdict[];
  pageSnapshot: string;
  actionHistory: AgentActionHistoryEntry[];
  constraints: BehaviorRunConstraints;
  startedAt: number;
  iterationsUsed: number;
}): AgentIterationContext {
  return {
    scenarioTitle: input.scenarioTitle,
    gherkinSteps: input.gherkinSteps,
    currentStepIndex: input.currentStepIndex,
    completedSteps: input.completedSteps,
    thenVerdicts: input.thenVerdicts,
    pageSnapshot: input.pageSnapshot,
    actionHistory: input.actionHistory,
    constraints: input.constraints,
    elapsedMs: Date.now() - input.startedAt,
    iterationsUsed: input.iterationsUsed,
  };
}

function stepPositionLabel(steps: GherkinStep[], stepIndex: number): string {
  const step = steps[stepIndex];
  if (!step) return `Step ${stepIndex + 1}`;
  return `Step ${stepIndex + 1}/${steps.length} — ${step.effectiveKind}: ${step.text}`;
}

function commandLine(command: string, args: string[]): string {
  return ['agent-browser', command, ...displayArgs(command, args)].join(' ');
}

export function formatActionForProgress(
  action: UiBrowserAgentAction,
  steps: GherkinStep[],
  currentStepIndex: number,
): string {
  switch (action.kind) {
    case 'agentBrowserCommand':
      return steps[currentStepIndex]
        ? `${commandLine(action.command, action.args)} — ${stepPositionLabel(steps, currentStepIndex)}`
        : `${commandLine(action.command, action.args)}…`;
    case 'stepComplete':
      return `Done — ${stepPositionLabel(steps, action.stepIndex)}`;
    case 'assertThen': {
      const label = stepPositionLabel(steps, action.stepIndex);
      return action.satisfied
        ? `Verified — ${label}`
        : `Check failed — ${label}`;
    }
    case 'stepFailed':
      return `Step failed — ${action.reason}`;
    case 'scenarioComplete':
      return 'Scenario complete — all checks passed';
  }
}

export function formatActionForHistory(action: UiBrowserAgentAction): string {
  switch (action.kind) {
    case 'agentBrowserCommand': return `${action.command} ${displayArgs(action.command, action.args).join(' ')}`.trim();
    case 'stepComplete': return `stepComplete ${action.stepIndex}`;
    case 'assertThen': return `assertThen ${action.stepIndex} ${action.satisfied}`;
    case 'stepFailed': return `stepFailed ${action.stepIndex}`;
    case 'scenarioComplete': return 'scenarioComplete';
  }
}

function displayArgs(command: string, args: string[]): string[] {
  if ((command === 'fill' || command === 'type') && args.length > 1) {
    return [args[0]!, '[redacted]'];
  }
  if (command === 'keyboard' && args.length > 1) {
    return [args[0]!, '[redacted]'];
  }
  if (command === 'find') {
    const actionIndex = findActionIndex(args);
    if (actionIndex >= 0 && ['fill', 'type'].includes(args[actionIndex]!) && args.length > actionIndex + 1) {
      return [...args.slice(0, actionIndex + 1), '[redacted]'];
    }
  }
  return args;
}

function findActionIndex(args: string[]): number {
  return args.findIndex(arg => ['click', 'dblclick', 'hover', 'focus', 'fill', 'type', 'check', 'uncheck'].includes(arg));
}
