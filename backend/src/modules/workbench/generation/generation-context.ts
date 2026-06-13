import type { IsolationResult, PlanApproval, TestPlan } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';
import { GUARDRAIL_UI_TEST_DESIGN } from '../plan/plan-questions-context.js';
import { resolvePlanAnswers } from '../plan/resolve-plan-answers.js';
import { deriveGenerationScope, type ScopedBehavior } from './generation-scope.js';

export interface GenerationModelContext {
  intent: unknown;
  isolation: IsolationResult;
  plan: TestPlan;
  approval: PlanApproval;
  repository: Pick<RepositoryContext, 'repo' | 'frontend' | 'relatedFiles' | 'specDocs' | 'qcCases' | 'sourceSnippets'>;
  onboarding: RepositoryContext['onboarding'];
  guardrailUiTestDesign: typeof GUARDRAIL_UI_TEST_DESIGN;
  generationScope: {
    behaviorsToStage: ScopedBehavior[];
    minimumChangeCount: number;
  };
  generationPolicy: {
    oneChangePerBehavior: boolean;
    includeGherkinSteps: boolean;
    neverGenerateProductionCode: boolean;
    honorResolvedPlanAnswers: boolean;
  };
  resolvedPlanAnswers: ReturnType<typeof resolvePlanAnswers>;
}

export function buildGenerationContext(
  isolation: IsolationResult,
  plan: TestPlan,
  repository: RepositoryContext,
  intent: unknown,
  approval: PlanApproval,
): GenerationModelContext {
  const behaviorsToStage = deriveGenerationScope(isolation, plan);

  return {
    intent,
    isolation,
    plan,
    approval,
    repository: {
      repo: repository.repo,
      frontend: repository.frontend,
      relatedFiles: repository.relatedFiles,
      specDocs: repository.specDocs,
      qcCases: repository.qcCases,
      sourceSnippets: repository.sourceSnippets,
    },
    onboarding: repository.onboarding,
    guardrailUiTestDesign: GUARDRAIL_UI_TEST_DESIGN,
    generationScope: {
      behaviorsToStage,
      minimumChangeCount: Math.max(behaviorsToStage.length, 1),
    },
    generationPolicy: {
      oneChangePerBehavior: true,
      includeGherkinSteps: true,
      neverGenerateProductionCode: true,
      honorResolvedPlanAnswers: true,
    },
    resolvedPlanAnswers: resolvePlanAnswers(plan, approval),
  };
}
