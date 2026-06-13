import type { Pool } from 'pg';
import type { DashboardPayload } from '../../onboarding/onboarding.types.js';
import { OnboardingRepository } from '../../onboarding/onboarding.repository.js';
import { ReposRepository } from '../../repos/repos.repository.js';
import type { RepoRecord } from '../../repos/repos.types.js';
import type { IntentInput } from '../workbench.types.js';
import type { OnboardingContextSlice, RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';
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

  async getContext(repoId: string, userId: string, intent?: IntentInput): Promise<RepositoryContext> {
    const repo = await this.#deps.getRepo(repoId, userId);
    if (!repo?.clonePath || repo.status !== 'cloned') {
      throw new Error(`Repository not found or not cloned: ${repoId}`);
    }

    const dashboard = await this.#deps.getDashboard(repoId, userId);
    const scanner = new RepositoryScanner({ rootDir: repo.clonePath });
    const files = await scanner.scanFiles(intent ?? {
      prompt: '', feature: null, testTypes: ['UI / Browser'], sources: ['Codebase'],
    });

    return {
      repo: {
        name: repo.name,
        path: repo.clonePath,
        branch: repo.currentBranch ?? repo.defaultBranch,
        commit: repo.commitSha ?? undefined,
      },
      ...files,
      qcCases: mapQcCases(dashboard),
      onboarding: mapOnboardingSlice(dashboard),
      frontend: {},
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

function mapQcCases(_dashboard: DashboardPayload | null) {
  return [];
}
