import type { IntentInput, QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';

export interface SourceSnippet {
  path: string;
  startLine: number;
  endLine: number;
  summary: string;
  text: string;
}

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
  sourceSnippets: SourceSnippet[];
}

export interface RepositoryContextProvider {
  getContext(repoId: string, intent?: IntentInput): Promise<RepositoryContext>;
}
