import type { GeneratedChange, GenerationResult } from '../../workbench.types.js';

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

export function splitScenarioTexts(featureText: string): string[] {
  const lines = featureText.split('\n');
  const headerLines: string[] = [];
  const scenarios: string[][] = [];
  let currentScenario: string[] | null = null;

  for (const line of lines) {
    if (/^\s*Scenario(?: Outline)?:/i.test(line)) {
      currentScenario = [...headerLines, line];
      scenarios.push(currentScenario);
      continue;
    }

    if (currentScenario) {
      currentScenario.push(line);
    } else if (line.trim()) {
      headerLines.push(line);
    }
  }

  return scenarios.length > 0
    ? scenarios.map(scenario => scenario.join('\n').trim()).filter(Boolean)
    : [featureText.trim()].filter(Boolean);
}
