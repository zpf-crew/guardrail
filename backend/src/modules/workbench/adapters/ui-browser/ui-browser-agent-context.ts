import type { BehaviorRunConstraints, ThenVerdict } from '../../workbench.types.js';
import type { GherkinStep } from './gherkin-step-parser.js';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

export const MAX_THEN_OBSERVATION_ACTIONS = 6;

export interface AgentActionHistoryEntry {
  iteration: number;
  action: string;
  result: 'ok' | 'failed';
  detail?: string;
}

export interface AgentIterationCurrentStep {
  index: number;
  kind: string;
  effectiveKind: string;
  text: string;
  observationOnlyActionsUsed: number;
  observationOnlyActionsRemaining: number;
  verdictRequiredNow: boolean;
}

export interface AgentIterationContext {
  scenarioTitle: string;
  gherkinSteps: GherkinStep[];
  currentStepIndex: number;
  currentStep: AgentIterationCurrentStep;
  completedSteps: Array<{ index: number; note: string }>;
  thenVerdicts: ThenVerdict[];
  pageSnapshot: string;
  actionHistory: AgentActionHistoryEntry[];
  constraints: BehaviorRunConstraints;
  elapsedMs: number;
  iterationsUsed: number;
  allowedActionKinds: Array<UiBrowserAgentAction['kind']>;
  allowedCommands: string[];
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
  observationOnlyActionsForCurrentStep: number;
}): AgentIterationContext {
  const step = input.gherkinSteps[input.currentStepIndex];
  const effectiveKind = step?.effectiveKind ?? 'Then';
  const observationOnlyActionsUsed = input.observationOnlyActionsForCurrentStep;
  const observationOnlyActionsRemaining = Math.max(0, MAX_THEN_OBSERVATION_ACTIONS - observationOnlyActionsUsed);
  const verdictRequiredNow = effectiveKind === 'Then' && observationOnlyActionsRemaining === 0;
  const scenarioCompleteAllowed = allThenStepsSatisfied(input.gherkinSteps, input.thenVerdicts);

  return {
    scenarioTitle: input.scenarioTitle,
    gherkinSteps: input.gherkinSteps,
    currentStepIndex: input.currentStepIndex,
    currentStep: {
      index: input.currentStepIndex,
      kind: step?.kind ?? effectiveKind,
      effectiveKind,
      text: step?.text ?? '',
      observationOnlyActionsUsed,
      observationOnlyActionsRemaining,
      verdictRequiredNow,
    },
    completedSteps: input.completedSteps,
    thenVerdicts: input.thenVerdicts,
    pageSnapshot: input.pageSnapshot,
    actionHistory: input.actionHistory,
    constraints: input.constraints,
    elapsedMs: Date.now() - input.startedAt,
    iterationsUsed: input.iterationsUsed,
    allowedActionKinds: allowedActionKindsForStep(effectiveKind, verdictRequiredNow, scenarioCompleteAllowed),
    allowedCommands: allowedCommandsForStep(effectiveKind, verdictRequiredNow),
  };
}

function allThenStepsSatisfied(steps: GherkinStep[], thenVerdicts: ThenVerdict[]): boolean {
  const thenIndexes = steps
    .map((step, index) => step.effectiveKind === 'Then' ? index : null)
    .filter((index): index is number => index !== null);
  return thenIndexes.length > 0
    && thenIndexes.every(index => thenVerdicts.some(verdict => verdict.stepIndex === index && verdict.satisfied));
}

function allowedActionKindsForStep(
  effectiveKind: string,
  verdictRequiredNow: boolean,
  scenarioCompleteAllowed: boolean,
): Array<UiBrowserAgentAction['kind']> {
  const completionAction = scenarioCompleteAllowed ? ['scenarioComplete' as const] : [];
  if (effectiveKind === 'Then') {
    return verdictRequiredNow
      ? ['assertThen', 'stepFailed', ...completionAction]
      : ['agentBrowserCommand', 'assertThen', 'stepFailed', ...completionAction];
  }
  return ['agentBrowserCommand', 'stepComplete', 'stepFailed', ...completionAction];
}

function allowedCommandsForStep(effectiveKind: string, verdictRequiredNow: boolean): string[] {
  if (effectiveKind === 'Then') {
    return verdictRequiredNow ? [] : ['snapshot', 'get', 'is', 'scroll', 'click'];
  }
  return ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'];
}

function stepPositionLabel(steps: GherkinStep[], stepIndex: number): string {
  const step = steps[stepIndex];
  if (!step) return `Step ${stepIndex + 1}`;
  return `Step ${stepIndex + 1} — ${step.effectiveKind}: ${step.text}`;
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
