import type { UiBrowserScenarioPlan } from '../../validation/workbench-validators.js';

const GENERIC_PLAN_TOKENS = new Set([
  'after',
  'before',
  'button',
  'check',
  'clicked',
  'click',
  'complete',
  'completes',
  'control',
  'current',
  'durable',
  'expected',
  'field',
  'find',
  'first',
  'homepage',
  'home',
  'input',
  'interaction',
  'item',
  'items',
  'link',
  'loaded',
  'loads',
  'locate',
  'main',
  'navigate',
  'needed',
  'page',
  'ready',
  'reflects',
  'relevant',
  'route',
  'scroll',
  'scrolling',
  'state',
  'target',
  'text',
  'updated',
  'value',
  'verify',
  'visible',
]);

const IGNORED_TOKENS = new Set([
  'and',
  'are',
  'for',
  'has',
  'have',
  'into',
  'its',
  'one',
  'that',
  'the',
  'then',
  'this',
  'with',
]);

export function assertScenarioPlanGrounded(
  plan: UiBrowserScenarioPlan,
  scenarioText: string,
): void {
  const sourceTokens = tokenSet(scenarioText);
  const unsupported = new Set<string>();

  for (const step of plan.steps) {
    if (step.kind === 'setup') continue;
    const plannedText = [step.instruction, step.successCriteria].filter(Boolean).join(' ');
    for (const token of tokenSet(plannedText)) {
      if (!sourceTokens.has(token) && !GENERIC_PLAN_TOKENS.has(token)) {
        unsupported.add(token);
      }
    }
  }

  if (unsupported.size > 0) {
    throw new Error(`Scenario plan is not grounded in the Gherkin source. Unsupported term(s): ${[...unsupported].slice(0, 8).join(', ')}`);
  }
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.map(normalizeToken)
      .filter(token => token.length >= 3 && !IGNORED_TOKENS.has(token)) ?? [],
  );
}

function normalizeToken(token: string): string {
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}
