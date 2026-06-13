import type { IntentInput, QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';

export interface SourceSnippet {
  path: string;
  startLine: number;
  endLine: number;
  summary: string;
  text: string;
}

export interface OnboardingContextSlice {
  lastScanAt: string | null;
  health: { score: number; grade: string } | null;
  coverage: number | null;
  testCases: Array<{
    id: string;
    title: string;
    status: string;
    type: string;
    feature: string;
    risk: string;
  }>;
  insights: Array<{
    id: string;
    title: string;
    severity: string;
    description: string;
  }>;
}

export interface RepositoryContext {
  repo: RepoRef;
  frontend?: {
    startCommand?: string;
    healthUrl?: string;
    url?: string;
    route?: string;
  };
  relatedFiles: RelatedFile[];
  specDocs: RelatedFile[];
  qcCases: QCTestCase[];
  sourceSnippets: SourceSnippet[];
  onboarding: OnboardingContextSlice;
}

export interface RepositoryContextProvider {
  getContext(repoId: string, userId: string, intent?: IntentInput): Promise<RepositoryContext>;
}
