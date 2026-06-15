import type { DashboardPayload, GitHubRepoSummary } from '../types/testlens';

export async function findDashboardReadyRepoIds(
  repos: GitHubRepoSummary[],
  loadDashboard: (repoId: string) => Promise<DashboardPayload>,
): Promise<Set<string>> {
  const candidates = repos.filter(repo => repo.isCloned && repo.repoId);
  const results = await Promise.all(candidates.map(async repo => {
    try {
      const dashboard = await loadDashboard(repo.repoId!);
      return dashboard.lastScanAt && dashboard.testCases.length > 0 ? repo.repoId! : null;
    } catch {
      return null;
    }
  }));

  return new Set(results.filter((repoId): repoId is string => Boolean(repoId)));
}

export function splitOnboardingRepos(repos: GitHubRepoSummary[], dashboardReadyRepoIds: Set<string>) {
  const dashboardReady: GitHubRepoSummary[] = [];
  const onboarding: GitHubRepoSummary[] = [];

  for (const repo of repos) {
    if (repo.repoId && dashboardReadyRepoIds.has(repo.repoId)) {
      dashboardReady.push(repo);
    } else {
      onboarding.push(repo);
    }
  }

  return { dashboardReady, onboarding };
}
