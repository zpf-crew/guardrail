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

export function formatActionForProgress(
  action: UiBrowserAgentAction,
  steps: GherkinStep[],
  currentStepIndex: number,
): string {
  switch (action.kind) {
    case 'open':
      return 'Navigating to page…';
    case 'wait':
      return 'Waiting for page to finish loading…';
    case 'click':
      return steps[currentStepIndex]
        ? `Interacting — ${stepPositionLabel(steps, currentStepIndex)}`
        : `Clicking ${action.ref}…`;
    case 'fill':
      return steps[currentStepIndex]
        ? `Entering text — ${stepPositionLabel(steps, currentStepIndex)}`
        : `Filling ${action.ref}…`;
    case 'screenshot':
      return `Capturing screenshot — ${action.label}`;
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
    case 'open': return `open ${action.path}`;
    case 'wait': return `wait ${action.load}`;
    case 'click': return `click ${action.ref}`;
    case 'fill': return `fill ${action.ref}`;
    case 'screenshot': return `screenshot ${action.label}`;
    case 'stepComplete': return `stepComplete ${action.stepIndex}`;
    case 'assertThen': return `assertThen ${action.stepIndex} ${action.satisfied}`;
    case 'stepFailed': return `stepFailed ${action.stepIndex}`;
    case 'scenarioComplete': return 'scenarioComplete';
  }
}
