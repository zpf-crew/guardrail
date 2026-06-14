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
