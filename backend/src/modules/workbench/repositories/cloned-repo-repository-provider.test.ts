import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClonedRepoRepositoryProvider } from './cloned-repo-repository-provider.js';

test('returns hybrid context from clone scan and onboarding dashboard', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-clone-'));
  await mkdir(join(root, 'frontend', 'src', 'pages'), { recursive: true });
  await writeFile(join(root, 'frontend', 'src', 'pages', 'Home.tsx'), 'export default function Home() {}');

  const provider = new ClonedRepoRepositoryProvider({
    getRepo: async () => ({
      id: 'repo-1',
      githubRepoId: 1,
      fullName: 'acme/acme-app',
      name: 'acme-app',
      private: false,
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/acme/acme-app.git',
      htmlUrl: 'https://github.com/acme/acme-app',
      clonePath: root,
      currentBranch: 'main',
      commitSha: 'abc123',
      status: 'cloned',
    }),
    getDashboard: async () => ({
      lastScanAt: '2026-06-13T00:00:00.000Z',
      health: { score: 72, max: 100, grade: 'C+', trend: { value: 0, sentiment: 'neutral' } },
      metrics: { coverage: { value: 45 } },
      testCases: [{
        id: 'TC-1', title: 'Login flow', status: 'missing', type: 'UI / Browser',
        feature: 'Auth', risk: 'High', lastRunAt: null, recentRuns: [], description: 'No UI test',
      }],
      insights: [{ id: 'INS-1', severity: 'High', title: 'Missing UI coverage', description: 'Auth untested', action: 'Generate missing tests', relatedTestIds: ['TC-1'] }],
      repo: { name: 'acme-app', path: root, branch: 'main' },
      filesIndexed: 10,
    }),
  });

  const context = await provider.getContext('repo-1', 'user-1', {
    prompt: 'improve login UI test',
    feature: 'Auth',
    testTypes: ['UI / Browser'],
    sources: ['Codebase'],
  });

  assert.equal(context.repo.name, 'acme-app');
  assert.equal(context.repo.path, root);
  assert.equal(context.onboarding.testCases[0]?.id, 'TC-1');
  assert.ok(context.relatedFiles.length > 0);
  assert.equal(context.onboarding.lastScanAt, '2026-06-13T00:00:00.000Z');
});

test('rejects repo that is not cloned', async () => {
  const provider = new ClonedRepoRepositoryProvider({
    getRepo: async () => null,
    getDashboard: async () => null,
  });

  await assert.rejects(
    () => provider.getContext('missing', 'user-1'),
    /Repository not found|not cloned/,
  );
});

test('proceeds with empty onboarding when dashboard missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-clone-'));
  await writeFile(join(root, 'package.json'), '{}');

  const provider = new ClonedRepoRepositoryProvider({
    getRepo: async () => ({
      id: 'repo-2',
      githubRepoId: 2,
      fullName: 'acme/bare',
      name: 'bare',
      private: false,
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/acme/bare.git',
      htmlUrl: 'https://github.com/acme/bare',
      clonePath: root,
      currentBranch: 'main',
      commitSha: null,
      status: 'cloned',
    }),
    getDashboard: async () => null,
  });

  const context = await provider.getContext('repo-2', 'user-1', {
    prompt: 'test', feature: null, testTypes: ['UI / Browser'], sources: ['Codebase'],
  });

  assert.deepEqual(context.onboarding.testCases, []);
  assert.equal(context.onboarding.lastScanAt, null);
});
