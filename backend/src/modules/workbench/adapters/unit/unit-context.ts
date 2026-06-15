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

const MAX_GENERATION_SNIPPETS = 8;
const MAX_SNIPPET_CHARS = 6_000;
const MAX_TOTAL_SNIPPET_CHARS = 24_000;
const GENERIC_SEARCH_TERMS = new Set([
  'src', 'test', 'tests', 'spec', 'unit', 'file', 'with', 'from', 'include',
]);

function searchTerms(values: string[]): string[] {
  return [...new Set(values
    .flatMap(value => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter(term => term.length >= 3 && !GENERIC_SEARCH_TERMS.has(term)))];
}

function includesTerm(value: string, terms: string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.some(term => normalized.includes(term));
}

function scopedGenerationRepository(
  repository: RepositoryContext,
  isolation: IsolationResult,
  behaviorsToStage: Array<{ behavior: string; file: string }>,
) {
  const feature = isolation.target.feature;
  const terms = searchTerms([
    feature,
    ...behaviorsToStage.map(item => item.behavior),
    ...behaviorsToStage.map(item => item.file),
  ]);
  const relevantPaths = new Set([
    ...isolation.sourceFiles.map(file => file.path),
    ...isolation.existingTestFiles.map(file => file.path),
    ...behaviorsToStage.map(item => item.file),
  ]);
  const snippets = repository.sourceSnippets.filter(snippet =>
    relevantPaths.has(snippet.path)
    || includesTerm(snippet.path, terms)
    || includesTerm(snippet.summary, terms));
  let totalChars = 0;
  const sourceSnippets = snippets.slice(0, MAX_GENERATION_SNIPPETS).flatMap(snippet => {
    const remaining = MAX_TOTAL_SNIPPET_CHARS - totalChars;
    if (remaining <= 0) return [];
    const text = snippet.text.slice(0, Math.min(MAX_SNIPPET_CHARS, remaining));
    totalChars += text.length;
    return [{ ...snippet, text }];
  });

  return {
    repo: repository.repo,
    relatedFiles: repository.relatedFiles.filter(file =>
      relevantPaths.has(file.path) || includesTerm(file.path, terms)),
    specDocs: repository.specDocs.filter(file => includesTerm(file.path, terms)).slice(0, 5),
    qcCases: repository.qcCases.filter(item =>
      includesTerm(`${item.feature} ${item.scenario} ${item.expectedResult}`, terms)).slice(0, 10),
    sourceSnippets,
    existingTestSnippets: sourceSnippets.filter(snippet => /\.(test|spec)\.[cm]?[jt]sx?$/i.test(snippet.path)),
  };
}

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
  const scopedBehaviors = new Set(behaviorsToStage.map(item => item.behavior.toLowerCase()));
  const scopedIsolation = {
    ...isolation,
    classifications: isolation.classifications.filter(item =>
      scopedBehaviors.has(item.behavior.toLowerCase())),
  };
  return {
    intent,
    isolation: scopedIsolation,
    plan,
    approval,
    repository: scopedGenerationRepository(repository, isolation, behaviorsToStage),
    onboarding: {
      health: repository.onboarding.health,
      coverage: repository.onboarding.coverage,
      testCases: repository.onboarding.testCases.filter(item =>
        item.feature.toLowerCase() === isolation.target.feature.toLowerCase()).slice(0, 10),
      insights: repository.onboarding.insights.filter(item =>
        item.title.toLowerCase().includes(isolation.target.feature.toLowerCase())).slice(0, 5),
    },
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
