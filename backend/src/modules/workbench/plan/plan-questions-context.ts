import type { IsolationResult } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

/** Guardrail UI/Browser test design facts the plan question model must treat as settled. */
export const GUARDRAIL_UI_TEST_DESIGN = {
  runner: 'agent-browser',
  browser: 'Chromium (via agent-browser CLI)',
  devServer: 'Guardrail starts a managed local dev server before the run step',
  scenarioFormat: 'Gherkin-style scenarios staged under guardrail-tests/ui/*.feature',
  runPipeline: [
    'Resolve dev-server target from cloned repo',
    'Start subprocess and wait for health',
    'agent-browser open {baseUrl}{route}',
    'Map scenario steps to click, fill, assertText, screenshot actions',
    'Capture screenshot evidence for the review step',
  ],
  runBudgets: {
    defaultMaxStepDurationMs: 60_000,
    defaultMaxSteps: 15,
    overrideField: 'runConstraintOverrides',
  },
  selectors: 'Prefer role/name and visible text; use repository snippets for labels',
  transientUiPolicy: {
    transientSignals: ['toast', 'snackbar', 'notification banner', 'loading spinner', 'animation'],
    rule: 'Treat transient UI feedback as supporting evidence only, not the primary behavior or required assertion.',
    durableAlternatives: [
      'cart count',
      'cart contents',
      'route or page state',
      'persisted field value',
      'selected or saved state',
      'stable validation text',
      'table row',
    ],
    exception: 'Only make transient UI the target behavior when the user intent, specs, or QC cases explicitly ask to test transient feedback itself.',
  },
  notUsed: [
    'Playwright',
    'Cypress',
    'Selenium',
    'Vitest jsdom',
    'React Testing Library component tests',
    'Puppeteer as a separate stack',
  ],
} as const;

export interface PlanQuestionsModelContext {
  intent: unknown;
  isolation: IsolationResult;
  repository: Pick<RepositoryContext, 'repo' | 'frontend' | 'relatedFiles' | 'specDocs' | 'qcCases' | 'sourceSnippets'>;
  onboarding: RepositoryContext['onboarding'];
  guardrailUiTestDesign: typeof GUARDRAIL_UI_TEST_DESIGN;
  resolvedEvidence: {
    routes: string[];
    sourcePages: string[];
    specDocPaths: string[];
    existingTestPaths: string[];
  };
  questionPolicy: {
    askOnlyWhen: string[];
    neverAskAbout: string[];
  };
}

export function buildPlanQuestionsContext(
  isolation: IsolationResult,
  repository: RepositoryContext,
  intent: unknown,
): PlanQuestionsModelContext {
  const routes = [
    repository.frontend?.route,
    repository.frontend?.url,
    ...isolation.userJourneys.filter(journey => /\/|page|route|open /i.test(journey)),
  ].filter((value): value is string => Boolean(value));

  return {
    intent,
    isolation,
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
    resolvedEvidence: {
      routes: [...new Set(routes)],
      sourcePages: isolation.sourceFiles.map(file => file.path),
      specDocPaths: isolation.specDocs.map(file => file.path),
      existingTestPaths: isolation.existingTestFiles.map(file => file.path),
    },
    questionPolicy: {
      askOnlyWhen: [
        'Product specs or QC cases contradict each other',
        'Product specs or QC cases contradict scanned source behavior',
        'Required user-visible behavior is missing from specs, QC, and source snippets',
        'Approval would encode unsafe assumptions about business rules',
      ],
      neverAskAbout: [
        'Test framework or runner (agent-browser is fixed)',
        'Playwright, Cypress, Vitest, jsdom, or Testing Library',
        'Routes, homepage URL, or page component paths already listed in resolvedEvidence',
        'Cart/state/API implementation details answerable from sourceSnippets',
        'Transient toast, snackbar, notification, loading, or animation feedback unless explicitly requested as the product behavior',
        'Whether browser automation is needed when intent includes UI / Browser',
      ],
    },
  };
}
