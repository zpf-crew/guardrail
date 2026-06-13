import type { GenerationResult } from '../../workbench.types.js';
import type { UiBrowserRunPlan } from '../../validation/workbench-validators.js';

export function scenarioTextFromGeneration(generation: GenerationResult): string {
  return generation.changes
    .filter(change => change.testType === 'UI / Browser')
    .flatMap(change => change.diff.filter(line => line.kind === 'add' || line.kind === 'context').map(line => line.text))
    .join('\n')
    .trim();
}

export function fallbackRunPlanFromScenario(scenarioText: string): UiBrowserRunPlan {
  const wantsContinue = /\bcontinue\b/i.test(scenarioText);
  const wantsScan = /\bscan|progress|complete\b/i.test(scenarioText);
  return {
    scenarioTitle: titleFromScenario(scenarioText),
    actions: [
      { kind: 'open', path: '/onboarding' },
      { kind: 'waitForLoad', state: 'networkidle' },
      { kind: 'snapshot' },
      { kind: 'screenshot', label: 'Onboarding page loaded' },
      ...(wantsContinue ? [{ kind: 'click' as const, role: 'button', name: 'Continue' }] : []),
      { kind: 'waitForLoad', state: 'networkidle' },
      ...(wantsScan ? [{ kind: 'screenshot' as const, label: 'Onboarding progress evidence' }] : []),
    ],
  };
}

function titleFromScenario(text: string): string {
  const match = text.match(/Scenario:\s*(.+)/i);
  return match?.[1]?.trim() || 'Generated UI Browser scenario';
}
