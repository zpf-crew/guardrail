import type { GeneratedChange, GenerationResult } from '../../workbench.types.js';
import type { UiBrowserRunPlan } from '../../validation/workbench-validators.js';
import { resolveRouteFromScenario } from '../../dev-server/dev-server-resolver.js';

export function scenarioTextFromGeneration(generation: GenerationResult): string {
  return generation.changes
    .filter(change => change.testType === 'UI / Browser')
    .flatMap(change => scenarioTextFromChange(change))
    .join('\n')
    .trim();
}

export function scenarioTextFromChange(change: GeneratedChange): string {
  return change.diff
    .filter(line => line.kind === 'add' || line.kind === 'context')
    .map(line => line.text)
    .join('\n')
    .trim();
}

export function parseScenarioRunPlan(scenarioText: string, defaultRoute = '/'): UiBrowserRunPlan {
  const resolvedRoute = resolveRouteFromScenario(scenarioText);
  const route = resolvedRoute === '/' ? defaultRoute : resolvedRoute;
  const title = titleFromScenario(scenarioText);
  const clickMatch = scenarioText.match(/click(?:s)?\s+(?:the\s+)?(.+?)(?:\n|$)/i);
  const assertMatch = scenarioText.match(/Then\s+(.+?)\s+(?:is|are)\s+visible/i)
    ?? scenarioText.match(/Then\s+(.+)/i);

  const actions: UiBrowserRunPlan['actions'] = [
    { kind: 'open', path: route },
    { kind: 'waitForLoad', state: 'networkidle' },
    { kind: 'screenshot', label: `${title} loaded` },
  ];

  if (clickMatch?.[1]) {
    actions.push({ kind: 'click', role: 'button', name: clickMatch[1].trim() });
    actions.push({ kind: 'waitForLoad', state: 'networkidle' });
  }
  if (assertMatch?.[1]) {
    actions.push({ kind: 'assertText', text: assertMatch[1].trim() });
  }
  actions.push({ kind: 'screenshot', label: `${title} evidence` });

  return { scenarioTitle: title, actions };
}

export function fallbackRunPlanFromScenario(scenarioText: string): UiBrowserRunPlan {
  return parseScenarioRunPlan(scenarioText);
}

function titleFromScenario(text: string): string {
  const match = text.match(/Scenario:\s*(.+)/i);
  return match?.[1]?.trim() || 'Generated UI Browser scenario';
}
