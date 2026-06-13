import type { QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';
import type { RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';

interface LocalGuardrailRepositoryProviderOptions {
  rootDir: string;
}

const relatedFiles: RelatedFile[] = [
  {
    path: 'frontend/src/pages/OnboardingPage.tsx',
    kind: 'source',
    meta: 'Primary onboarding flow page for selected repository setup.',
  },
  {
    path: 'frontend/src/data/onboardingMockData.ts',
    kind: 'source',
    meta: 'Mock onboarding data used by the hackathon slice.',
  },
  {
    path: 'frontend/src/pages/GenerateTestsPage.tsx',
    kind: 'source',
    meta: 'Generate/improve tests page connected to the workbench experience.',
  },
  {
    path: 'frontend/src/data/workbench-api.ts',
    kind: 'source',
    meta: 'Frontend workbench API data adapter.',
  },
];

const qcCases: QCTestCase[] = [
  {
    id: 'QC-ONB-001',
    feature: 'Onboarding',
    scenario: 'Complete onboarding with local repository and optional knowledge sources',
    expectedResult: 'The onboarding flow reaches the initial scan step and shows progress or completion state.',
    priority: 'High',
    automationStatus: 'missing',
  },
];

const specDocs: RelatedFile[] = [];
const sourceSnippets: RepositoryContext['sourceSnippets'] = [];

export class LocalGuardrailRepositoryProvider implements RepositoryContextProvider {
  readonly #rootDir: string;

  constructor(options: LocalGuardrailRepositoryProviderOptions) {
    this.#rootDir = options.rootDir;
  }

  async getContext(_repoId: string): Promise<RepositoryContext> {
    const repo: RepoRef = {
      name: 'guardrail',
      path: this.#rootDir,
      branch: 'local',
    };

    return {
      repo,
      frontend: {
        startCommand: 'pnpm --dir frontend dev --host 127.0.0.1',
        healthUrl: 'http://localhost:5173',
        url: 'http://localhost:5173/onboarding',
        route: '/onboarding',
      },
      relatedFiles: structuredClone(relatedFiles),
      specDocs: structuredClone(specDocs),
      qcCases: structuredClone(qcCases),
      sourceSnippets: structuredClone(sourceSnippets),
    };
  }
}
