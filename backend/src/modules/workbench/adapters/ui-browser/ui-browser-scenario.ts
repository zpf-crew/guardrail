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
