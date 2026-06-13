import { basename, extname } from 'node:path';
import type {
  BehaviorClassification,
  FeatureModule,
  IntentInput,
  IsolationResult,
  RelatedFile,
  TestType,
} from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

export function buildIsolationResult(
  intent: IntentInput,
  repository: RepositoryContext,
  classifications: BehaviorClassification[],
): IsolationResult {
  const sourceFiles = repository.relatedFiles.filter(file => file.kind === 'source');
  const existingTestFiles = repository.relatedFiles.filter(file => file.kind === 'test');
  const resolvedClassifications = classifications.length > 0
    ? classifications
    : fallbackClassifications(intent, repository, sourceFiles);

  return {
    target: {
      feature: resolveTargetFeature(intent, repository),
      repo: repository.repo,
    },
    sourceFiles,
    existingTestFiles,
    specDocs: repository.specDocs,
    qcCases: repository.qcCases,
    currentCoverage: resolveCoverage(repository),
    currentStatus: resolveStatus(repository),
    userJourneys: deriveUserJourneys(intent, sourceFiles),
    classifications: resolvedClassifications,
  };
}

function resolveTargetFeature(intent: IntentInput, repository: RepositoryContext): FeatureModule {
  if (intent.feature) return intent.feature;
  const insight = repository.onboarding.insights[0]?.title;
  if (insight) return insight;
  return 'General';
}

function resolveCoverage(repository: RepositoryContext): { line: number; branch: number } {
  const coverage = repository.onboarding.coverage;
  if (typeof coverage === 'number' && Number.isFinite(coverage)) {
    return { line: Math.round(coverage), branch: Math.round(coverage) };
  }
  return { line: 0, branch: 0 };
}

function resolveStatus(repository: RepositoryContext): IsolationResult['currentStatus'] {
  const counts = { failed: 0, suspicious: 0, missing: 0, flaky: 0 };
  for (const testCase of repository.onboarding.testCases) {
    if (testCase.status === 'failed') counts.failed += 1;
    else if (testCase.status === 'suspicious') counts.suspicious += 1;
    else if (testCase.status === 'missing') counts.missing += 1;
    else if (testCase.status === 'flaky') counts.flaky += 1;
  }
  return counts;
}

function deriveUserJourneys(intent: IntentInput, sourceFiles: RelatedFile[]): string[] {
  const fromPages = sourceFiles
    .filter(file => /\/pages\//.test(file.path))
    .map(file => {
      const pageName = basename(file.path, extname(file.path));
      return `Open ${pageName} page`;
    });

  if (fromPages.length > 0) return fromPages.slice(0, 3);

  const prompt = intent.prompt.trim();
  if (prompt) return [prompt.slice(0, 120)];

  return ['Review isolated behavior in selected repository context'];
}

function fallbackClassifications(
  intent: IntentInput,
  repository: RepositoryContext,
  sourceFiles: RelatedFile[],
): BehaviorClassification[] {
  const suggestedTypes = intent.testTypes.length > 0 ? intent.testTypes : ['UI / Browser' as TestType];
  const behavior = intent.prompt.trim()
    || repository.onboarding.insights[0]?.title
    || 'Improve tests for selected repository behavior';

  return [{
    behavior,
    status: sourceFiles.length > 0 ? 'Weak' : 'Missing',
    suggestedTypes,
    risk: repository.onboarding.insights[0]?.severity === 'Critical' ? 'Critical' : 'High',
    explanation: sourceFiles.length > 0
      ? `Repository scan found ${sourceFiles.length} related source files; behavior-level classification was not returned by the model.`
      : 'Repository scan found limited related source files for this intent.',
  }];
}
