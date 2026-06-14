import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Evidence, GeneratedChange, TestResultRow } from '../../workbench.types.js';
import type {
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
  const wanted = new Set(sourceScenarioIndexes);
  return scenarios.filter(scenario => wanted.has(scenario.index));
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
