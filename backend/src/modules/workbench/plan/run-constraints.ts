import type { BehaviorRunConstraints } from '../workbench.types.js';

export const DEFAULT_MAX_STEP_DURATION_MS = 60_000;
export const DEFAULT_MAX_STEPS = 15;

const HEAVY_PATTERN = /\b(checkout|payment|3ds|poll|webhook|onboarding scan)\b/i;

export function buildDefaultRunConstraints(behaviors: string[]): BehaviorRunConstraints[] {
  return behaviors.map(behavior => ({
    behavior,
    maxStepDurationMs: DEFAULT_MAX_STEP_DURATION_MS,
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
      maxStepDurationMs: 120_000,
      maxSteps: 25,
      reason: 'Heavy flow detected; extended per-step agent run budget',
    };
  });
}

export function mergeRunConstraintOverrides(
  constraints: BehaviorRunConstraints[],
  overrides: BehaviorRunConstraints[] = [],
): BehaviorRunConstraints[] {
  if (overrides.length === 0) return constraints;

  const merged = new Map(constraints.map(item => [item.behavior, item]));
  for (const override of overrides) {
    const existing = merged.get(override.behavior);
    merged.set(override.behavior, existing ? { ...existing, ...override } : override);
  }
  return Array.from(merged.values());
}

export function lookupRunConstraints(
  constraints: BehaviorRunConstraints[] | undefined,
  behavior: string,
): BehaviorRunConstraints {
  const found = constraints?.find(item => item.behavior === behavior);
  return found ?? {
    behavior,
    maxStepDurationMs: DEFAULT_MAX_STEP_DURATION_MS,
    maxSteps: DEFAULT_MAX_STEPS,
  };
}
