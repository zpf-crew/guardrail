import { GUARDRAIL_UI_TEST_DESIGN } from '../plan/plan-questions-context.js';
import type { GeneratedChange, IsolationResult } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

export function buildRunPlanContext(input: {
  change: GeneratedChange;
  scenarioText: string;
  repository: RepositoryContext;
  isolation: IsolationResult;
  targetUrl: string;
}) {
  return {
    change: input.change,
    scenarioText: input.scenarioText,
    targetUrl: input.targetUrl,
    repository: {
      frontend: input.repository.frontend,
      sourceSnippets: input.repository.sourceSnippets,
    },
    guardrailUiTestDesign: GUARDRAIL_UI_TEST_DESIGN,
    availableActions: ['open', 'waitForLoad', 'snapshot', 'screenshot', 'click', 'fill', 'assertText'],
    schemaName: 'UiBrowserRunPlan',
  };
}
