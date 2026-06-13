import type { Pool } from 'pg';
import type { DashboardPayload } from '../../onboarding/onboarding.types.js';
import { OnboardingRepository } from '../../onboarding/onboarding.repository.js';
import { ReposRepository } from '../../repos/repos.repository.js';
import type { RepoRecord } from '../../repos/repos.types.js';
import type { IntentInput, QCTestCase } from '../workbench.types.js';
import type { OnboardingContextSlice, GetRepositoryContextOptions, RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';
import { resolveFrontendContext } from './frontend-route-resolver.js';
import { RepositoryScanner } from './repository-scanner.js';

interface ClonedRepoRepositoryProviderDeps {
  getRepo: (repoId: string, userId: string) => Promise<RepoRecord | null>;
  getDashboard: (repoId: string, userId: string) => Promise<DashboardPayload | null>;
}

export class ClonedRepoRepositoryProvider implements RepositoryContextProvider {
  readonly #deps: ClonedRepoRepositoryProviderDeps;

  constructor(deps: ClonedRepoRepositoryProviderDeps) {
    this.#deps = deps;
  }

  static fromDb(db: Pool): ClonedRepoRepositoryProvider {
    const repos = new ReposRepository(db);
    const onboarding = new OnboardingRepository(db);
    return new ClonedRepoRepositoryProvider({
      getRepo: (repoId, userId) => repos.getForUser(repoId, userId),
      getDashboard: (repoId, userId) => onboarding.getDashboard(repoId, userId),
    });
  }

  async getContext(
    repoId: string,
    userId: string,
    intent?: IntentInput,
    options?: GetRepositoryContextOptions,
  ): Promise<RepositoryContext> {
    const repo = await this.#deps.getRepo(repoId, userId);
    if (!repo?.clonePath || repo.status !== 'cloned') {
      throw new Error(`Repository not found or not cloned: ${repoId}`);
    }

    const dashboard = await this.#deps.getDashboard(repoId, userId);
    const scanner = new RepositoryScanner({ rootDir: repo.clonePath });
    const files = await scanner.scanFiles(intent ?? {
      prompt: '', feature: null, testTypes: ['UI / Browser'],
    }, { onProgress: options?.onProgress });
    const frontend = await resolveFrontendContext(repo.clonePath, intent ?? {
      prompt: '', feature: null, testTypes: ['UI / Browser'],
    });

    return {
      repo: {
        name: repo.name,
        path: repo.clonePath,
        branch: repo.currentBranch ?? repo.defaultBranch,
        commit: repo.commitSha ?? undefined,
      },
      ...files,
      ...(frontend ? { frontend } : {}),
      qcCases: mapQcCases(dashboard),
      onboarding: mapOnboardingSlice(dashboard),
    };
  }
}

function mapOnboardingSlice(dashboard: DashboardPayload | null): OnboardingContextSlice {
  if (!dashboard) {
    return { lastScanAt: null, health: null, coverage: null, testCases: [], insights: [] };
  }
  return {
    lastScanAt: dashboard.lastScanAt,
    health: { score: dashboard.health.score, grade: dashboard.health.grade },
    coverage: dashboard.metrics.coverage?.value ?? null,
    testCases: dashboard.testCases.map(tc => ({
      id: tc.id, title: tc.title, status: tc.status, type: tc.type, feature: tc.feature, risk: tc.risk,
    })),
    insights: dashboard.insights.map(ins => ({
      id: ins.id, title: ins.title, severity: ins.severity, description: ins.description,
    })),
  };
}

function mapQcCases(dashboard: DashboardPayload | null): QCTestCase[] {
  if (!dashboard) return [];
  return dashboard.testCases
    .filter(testCase => testCase.status === 'missing' || testCase.status === 'suspicious')
    .map(testCase => ({
      id: testCase.id,
      feature: testCase.feature,
      scenario: testCase.title,
      expectedResult: testCase.description || testCase.title,
      priority: testCase.risk === 'Critical' ? 'Critical'
        : testCase.risk === 'High' ? 'High'
        : testCase.risk === 'Medium' ? 'Medium' : 'Low',
      automationStatus: testCase.status === 'missing' ? 'missing' as const : 'unknown' as const,
    }));
}
