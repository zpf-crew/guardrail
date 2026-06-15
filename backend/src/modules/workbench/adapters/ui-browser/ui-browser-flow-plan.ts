import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Evidence, GeneratedChange, TestResultRow } from '../../workbench.types.js';
import type {
  UiBrowserAcceptedFlow,
  UiBrowserDroppedScenario,
  UiBrowserExecutionPlan,
  UiBrowserUserFlowPlan,
} from '../../validation/workbench-validators.js';
import { scenarioTextFromChange, splitScenarioTexts } from './ui-browser-scenario.js';

export interface IndexedUiScenario {
  index: number;
  title: string;
  text: string;
}

const TRANSIENT_UI_PATTERN = /\b(toast|snackbar|notification|loading|spinner|animation|animated|fade|appears briefly|disappears)\b/i;
const EXPLICIT_TRANSIENT_UI_PATTERN = new RegExp([
  '\\b(?:toast|snackbar|notification)\\s+(?:appears?|is shown|is visible|is dismissed|can be dismissed|disappears?)\\b',
  '\\bdismiss(?:es|ed|ing)?\\s+(?:the\\s+)?(?:toast|snackbar|notification)\\b',
  '\\bloading\\s+spinner\\b',
  '\\bspinner\\s+(?:appears?|is shown|is visible|disappears?)\\b',
  '\\banimation\\s+plays?\\b',
  '\\bfade\\s+out\\b',
  '\\bdisappears?\\b',
].join('|'), 'i');

export function indexedScenariosFromChange(change: GeneratedChange): IndexedUiScenario[] {
  return splitScenarioTexts(scenarioTextFromChange(change)).map((text, index) => ({
    index,
    title: scenarioTitleFromText(text, index),
    text,
  }));
}

export function sourceScenariosForFlow(
  scenarios: IndexedUiScenario[],
  sourceScenarioIndexes: number[],
): IndexedUiScenario[] {
  validateFlowSourceScenarios({ sourceScenarioIndexes }, scenarios);
  const wanted = new Set(sourceScenarioIndexes);
  return scenarios.filter(scenario => wanted.has(scenario.index));
}

export function validateFlowSourceScenarios(
  flow: Pick<UiBrowserAcceptedFlow, 'sourceScenarioIndexes' | 'id' | 'title'> | Pick<UiBrowserAcceptedFlow, 'sourceScenarioIndexes'>,
  scenarios: IndexedUiScenario[],
): void {
  const knownIndexes = new Set(scenarios.map(scenario => scenario.index));
  const missingIndexes = flow.sourceScenarioIndexes.filter(index => !knownIndexes.has(index));
  if (missingIndexes.length > 0) {
    const label = 'title' in flow ? ` for flow "${flow.title}"` : '';
    throw new Error(`Accepted UI Browser flow${label} cites unknown source scenario index ${missingIndexes.join(', ')}`);
  }
}

export function sanitizeExecutionPlan(
  plan: UiBrowserExecutionPlan,
  flow?: Pick<UiBrowserAcceptedFlow, 'userGoal' | 'durableOutcome' | 'title'>,
): UiBrowserExecutionPlan {
  const explicitTransientFlow = isExplicitTransientFlow(plan, flow);

  if (explicitTransientFlow) {
    return plan;
  }

  return {
    ...plan,
    steps: plan.steps.map(step => {
      const transientInstruction = TRANSIENT_UI_PATTERN.test(step.instruction);
      const transientSuccessCriteria = TRANSIENT_UI_PATTERN.test(step.successCriteria);

      if (!transientInstruction && !transientSuccessCriteria) {
        return step;
      }

      if (step.kind === 'action') {
        return {
          ...step,
          instruction: 'Perform the requested user action and continue to the durable assertion.',
          successCriteria: transientSuccessCriteria
            ? 'The action completes and the durable page state can be checked in the next assertion.'
            : step.successCriteria,
        };
      }

      if (step.kind === 'assert') {
        const durableOutcome = flow?.durableOutcome?.trim();
        if (durableOutcome) {
          return {
            ...step,
            instruction: `Verify that ${lowercaseFirst(trimSentencePeriod(durableOutcome))}.`,
            successCriteria: durableOutcome,
          };
        }

        return {
          ...step,
          instruction: 'Verify the durable page state for the expected behavior.',
          successCriteria: 'A durable page state confirms the expected behavior.',
        };
      }

      return {
        ...step,
        instruction: 'Prepare the page for the user flow.',
        successCriteria: transientSuccessCriteria
          ? 'The page is ready for the user flow.'
          : step.successCriteria,
      };
    }),
  };
}

function isExplicitTransientFlow(
  plan: UiBrowserExecutionPlan,
  flow?: Pick<UiBrowserAcceptedFlow, 'userGoal' | 'durableOutcome' | 'title'>,
): boolean {
  const text = flow
    ? [
      flow.title,
      flow.userGoal,
      flow.durableOutcome,
    ].filter(Boolean).join('\n')
    : plan.title;

  return EXPLICIT_TRANSIENT_UI_PATTERN.test(text);
}

function trimSentencePeriod(value: string): string {
  return value.trim().replace(/\.+$/, '');
}

function lowercaseFirst(value: string): string {
  return value.length > 0 ? `${value[0]!.toLocaleLowerCase()}${value.slice(1)}` : value;
}

export function buildDroppedScenarioRows(
  change: GeneratedChange,
  scenarios: IndexedUiScenario[],
  droppedScenarios: UiBrowserDroppedScenario[],
): TestResultRow[] {
  return droppedScenarios.map(dropped => {
    const scenario = scenarios.find(item => item.index === dropped.sourceScenarioIndex);
    const title = scenario?.title ?? `${change.title} scenario ${dropped.sourceScenarioIndex + 1}`;
    return {
      title,
      type: 'UI / Browser',
      status: 'Skipped',
      duration: null,
      evidence: null,
      reason: `Dropped before execution: ${dropped.reason}`,
      file: change.file,
    };
  });
}

export async function buildExecutionPlanTraceEvidence(payload: {
  flowPlan: UiBrowserUserFlowPlan;
  executionPlans: UiBrowserExecutionPlan[];
}): Promise<Evidence | null> {
  try {
    const dir = path.join(os.tmpdir(), 'guardrail-ui-browser-flow-plans');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${randomUUID()}.json`);
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return { kind: 'trace', label: 'UI Browser flow plan trace', href: filePath };
  } catch {
    return null;
  }
}

function scenarioTitleFromText(text: string, index: number): string {
  const match = text.match(/^\s*Scenario(?: Outline)?:\s*(.+)$/im);
  return match?.[1]?.trim() || `Scenario ${index + 1}`;
}
