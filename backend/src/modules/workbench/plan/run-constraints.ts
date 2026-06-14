import type { BehaviorRunConstraints } from '../workbench.types.js';

export const DEFAULT_MAX_DURATION_MS = 60_000;
export const DEFAULT_MAX_STEPS = 15;

const HEAVY_PATTERN = /\b(checkout|payment|3ds|poll|webhook|onboarding scan)\b/i;

export function buildDefaultRunConstraints(behaviors: string[]): BehaviorRunConstraints[] {
  return behaviors.map(behavior => ({
    behavior,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxSteps: DEFAULT_MAX_STEPS,
  }));
}

export function inferHeavyRunConstraints(
  constraints: BehaviorRunConstraints[],
): BehaviorRunConstraints[] {
  return constraints.map(item => {
    if (!HEAVY_PATTERN.test(item.behavior)) return item;
    return {
      ...item,
      maxDurationMs: 300_000,
      maxSteps: 25,
      reason: 'Heavy flow detected; extended agent run budget',
    };
  });
}

export function lookupRunConstraints(
  constraints: BehaviorRunConstraints[] | undefined,
  behavior: string,
): BehaviorRunConstraints {
  const found = constraints?.find(item => item.behavior === behavior);
  return found ?? {
    behavior,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxSteps: DEFAULT_MAX_STEPS,
  };
}
