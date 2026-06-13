import type { RepositoryContext } from '../repositories/repository-context-provider.js';
import { GUARDRAIL_UI_TEST_DESIGN } from '../plan/plan-questions-context.js';

export function buildIsolationContext(intent: unknown, repository: RepositoryContext) {
  return {
    intent,
    repository: {
      repo: repository.repo,
      relatedFiles: repository.relatedFiles,
      specDocs: repository.specDocs,
      qcCases: repository.qcCases,
      sourceSnippets: repository.sourceSnippets,
      frontend: repository.frontend,
    },
    onboarding: repository.onboarding,
    guardrailUiTestDesign: GUARDRAIL_UI_TEST_DESIGN,
    classificationPolicy: {
      onePerDistinctBehavior: true,
      preferUiBrowserForPageFlows: true,
      minimumClassifications: 1,
      useRepositoryEvidenceFirst: true,
    },
    schemaName: 'IsolationClassifications',
  };
}
