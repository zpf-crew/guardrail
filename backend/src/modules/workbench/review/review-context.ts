import type {
  GenerationResult,
  IsolationResult,
  PlanApproval,
  TestPlan,
  TestRunResult,
} from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';
import { GUARDRAIL_UI_TEST_DESIGN } from '../plan/plan-questions-context.js';
import { countUnresolvedPlanQuestions, resolvePlanAnswers } from '../plan/resolve-plan-answers.js';

export function buildReviewContext(input: {
  intent: unknown;
  isolation: IsolationResult;
  plan: TestPlan;
  approval: PlanApproval;
  generation: GenerationResult;
  run: TestRunResult;
  repository: RepositoryContext;
}) {
  return {
    intent: input.intent,
    isolation: input.isolation,
    plan: input.plan,
    approval: input.approval,
    resolvedPlanAnswers: resolvePlanAnswers(input.plan, input.approval),
    unresolvedPlanQuestions: countUnresolvedPlanQuestions(input.plan, input.approval),
    generation: input.generation,
    run: input.run,
    repository: { onboarding: input.repository.onboarding },
    guardrailUiTestDesign: GUARDRAIL_UI_TEST_DESIGN,
    schemaName: 'ReviewRecommendation',
  };
}
