import type { GenerationResult, IsolationResult, PlanApproval, TestPlan } from '../../workbench.types.js';
import type { RepositoryContext } from '../../repositories/repository-context-provider.js';
import { countUnresolvedPlanQuestions, resolvePlanAnswers } from '../../plan/resolve-plan-answers.js';
import type { ExpectedUnitRunner } from './unit-test-runner-style.js';

export const GUARDRAIL_UNIT_TEST_DESIGN = {
  scope: 'JS/TS unit tests',
  isolation: 'Generated files are materialized in a temporary git worktree before Apply.',
  apply: 'Real repository files are written only after user approval.',
  commandStrategy: 'Run focused generated test first; fallback to full test command only for CLI argument incompatibility.',
  notUsed: ['Browser automation', 'Screenshots', 'Managed dev server', 'Production code generation'],
} as const;

export function buildUnitIsolationContext(intent: unknown, repository: RepositoryContext) {
  return {
    intent,
    repository: {
      repo: repository.repo,
      relatedFiles: repository.relatedFiles,
      specDocs: repository.specDocs,
      qcCases: repository.qcCases,
      sourceSnippets: repository.sourceSnippets,
      onboarding: repository.onboarding,
    },
    unitTestDesign: GUARDRAIL_UNIT_TEST_DESIGN,
    classificationPolicy: {
      onePerDistinctBehavior: true,
      preferFunctionAndModuleBehavior: true,
      useRepositoryEvidenceFirst: true,
      minimumClassifications: 1,
    },
    schemaName: 'IsolationClassifications',
  };
}

export function buildUnitPlanContext(
  isolation: IsolationResult,
  repository: RepositoryContext,
  intent: unknown,
) {
  const existingTestPaths = isolation.existingTestFiles.map(file => file.path);
  return {
    intent,
    isolation,
    repository: {
      repo: repository.repo,
      relatedFiles: repository.relatedFiles,
      specDocs: repository.specDocs,
      qcCases: repository.qcCases,
      sourceSnippets: repository.sourceSnippets,
    },
    onboarding: repository.onboarding,
    unitTestDesign: GUARDRAIL_UNIT_TEST_DESIGN,
    resolvedEvidence: {
      sourceFiles: isolation.sourceFiles.map(file => file.path),
      existingTestPaths,
      specDocPaths: isolation.specDocs.map(file => file.path),
    },
    questionPolicy: {
      askOnlyWhen: [
        'Product specs or QC cases contradict each other',
        'Specs or QC cases contradict scanned source behavior',
        'A unit assertion would encode an unsafe business-rule assumption',
      ],
      neverAskAbout: [
        'Browser automation, routes, screenshots, or dev servers',
        'Test runner choice when package metadata or existing tests resolve it',
        'Mocking details that existing tests already demonstrate',
      ],
    },
    schemaName: 'TestPlanQuestions',
  };
}

export function buildUnitGenerationContext(
  isolation: IsolationResult,
  plan: TestPlan,
  repository: RepositoryContext,
  intent: unknown,
  approval: PlanApproval,
  behaviorsToStage: Array<{ behavior: string; action: 'Add' | 'Update' | 'Delete'; risk: string; file: string }>,
  expectedRunner: ExpectedUnitRunner,
  validationErrors: string[] = [],
) {
  return {
    intent,
    isolation,
    plan,
    approval,
    repository: {
      repo: repository.repo,
      relatedFiles: repository.relatedFiles,
      specDocs: repository.specDocs,
      qcCases: repository.qcCases,
      sourceSnippets: repository.sourceSnippets,
      existingTestSnippets: repository.sourceSnippets.filter(snippet => /\.(test|spec)\.[cm]?[jt]sx?$/i.test(snippet.path)),
    },
    onboarding: repository.onboarding,
    unitTestDesign: GUARDRAIL_UNIT_TEST_DESIGN,
    unitRunner: {
      expectedRunner,
      rule: 'Generated content must use the repository test runner style and expose at least one runnable test suite.',
    },
    generationScope: {
      behaviorsToStage,
      minimumChangeCount: Math.max(behaviorsToStage.length, 1),
    },
    generationPolicy: {
      oneChangePerBehavior: true,
      includeCompleteFileContent: true,
      neverGenerateProductionCode: true,
      honorResolvedPlanAnswers: true,
      requireProductionModuleImport: true,
      requireProductionCodeExecution: true,
      rejectTautologicalAssertions: true,
    },
    previousAttemptValidationErrors: validationErrors,
    resolvedPlanAnswers: resolvePlanAnswers(plan, approval),
    schemaName: 'GenerationChanges',
  };
}

export function buildUnitRunContext(input: {
  change: GenerationResult['changes'][number];
  repository: RepositoryContext;
  commandCandidates: string[];
}) {
  return {
    change: input.change,
    repository: {
      repo: input.repository.repo,
      relatedFiles: input.repository.relatedFiles,
      sourceSnippets: input.repository.sourceSnippets,
    },
    unitTestDesign: GUARDRAIL_UNIT_TEST_DESIGN,
    commandCandidates: input.commandCandidates,
    schemaName: 'UnitRunPlan',
  };
}

export function buildUnitReviewContext(input: {
  intent: unknown;
  isolation: IsolationResult;
  plan: TestPlan;
  approval: PlanApproval;
  generation: GenerationResult;
  run: import('../../workbench.types.js').TestRunResult;
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
    unitTestDesign: GUARDRAIL_UNIT_TEST_DESIGN,
    schemaName: 'ReviewRecommendation',
  };
}
