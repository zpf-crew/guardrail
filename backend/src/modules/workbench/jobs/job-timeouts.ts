import type { WorkflowStepId } from '../workbench.types.js';

export const WORKBENCH_STEP_TIMEOUT_MS: Record<WorkflowStepId, number> = {
  intent: 0,
  isolation: 90_000,
  plan: 90_000,
  generate: 120_000,
  run: 300_000,
  review: 60_000,
};
