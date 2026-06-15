import test from 'node:test';
import assert from 'node:assert/strict';
import type { DashboardPayload, GitHubRepoSummary } from '../types/testlens';
import { findDashboardReadyRepoIds, splitOnboardingRepos } from './onboarding-repo-options.ts';

const clonedRepo: GitHubRepoSummary = {
  githubRepoId: 1,
  repoId: 'repo-1',
  fullName: 'acme/checkout',
  name: 'checkout',
  owner: 'acme',
  private: true,
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/acme/checkout',
  isCloned: true,
};

const unclonedRepo: GitHubRepoSummary = {
  githubRepoId: 2,
  fullName: 'acme/docs',
  name: 'docs',
  owner: 'acme',
  private: false,
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/acme/docs',
};

function dashboard(overrides: Partial<DashboardPayload> = {}): DashboardPayload {
  return {
    repo: { name: 'checkout', path: '/tmp/checkout', branch: 'main' },
    lastScanAt: '2026-06-15T01:00:00.000Z',
    filesIndexed: 12,
    health: { score: 80, max: 100, grade: 'B', trend: { value: 0, sentiment: 'neutral' } },
    metrics: {
      totalTests: { value: 1 },
      passed: { value: 1 },
      failed: { value: 0 },
      flaky: { value: 0 },
      missing: { value: 0 },
      suspicious: { value: 0 },
      coverage: { value: 80, isPercent: true },
      highRiskOpen: { value: 0 },
    },
    testCases: [{ id: 'TC-1', title: 'Checkout works', status: 'passed', type: 'Unit', feature: 'Checkout', risk: 'Low', lastRunAt: '2026-06-15T01:00:00.000Z', recentRuns: [1], description: 'Checks checkout.' }],
    insights: [],
    structure: [],
    coverage: [],
    riskHeatmap: { columns: [], rows: [] },
    activity: [],
    ...overrides,
  };
}

test('findDashboardReadyRepoIds only marks cloned repos with completed dashboard data', async () => {
  const ready = await findDashboardReadyRepoIds([clonedRepo, unclonedRepo], async repoId => {
    assert.equal(repoId, 'repo-1');
    return dashboard();
  });

  assert.deepEqual([...ready], ['repo-1']);
});

test('findDashboardReadyRepoIds ignores cloned repos without scan results', async () => {
  const ready = await findDashboardReadyRepoIds([clonedRepo], async () => dashboard({ lastScanAt: '', testCases: [] }));

  assert.equal(ready.size, 0);
});

test('splitOnboardingRepos puts dashboard-ready repos first and keeps the rest available for onboarding', () => {
  const result = splitOnboardingRepos([unclonedRepo, clonedRepo], new Set(['repo-1']));

  assert.deepEqual(result.dashboardReady.map(repo => repo.repoId), ['repo-1']);
  assert.deepEqual(result.onboarding.map(repo => repo.githubRepoId), [2]);
});
