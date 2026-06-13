import type { QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';

export interface RepositoryContext {
  repo: RepoRef;
  frontend: {
    startCommand: string;
    healthUrl: string;
    url: string;
    route: '/onboarding';
  };
  relatedFiles: RelatedFile[];
  specDocs: RelatedFile[];
  qcCases: QCTestCase[];
  sourceSnippets: { path: string; summary: string; text: string }[];
}

export interface RepositoryContextProvider {
  getContext(repoId: string): Promise<RepositoryContext>;
}
