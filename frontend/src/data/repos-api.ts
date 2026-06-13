import type { ConnectedRepo, GitHubRepoSummary, RepoFileContent, RepoFileNode } from '@/types/testlens';
import { githubRepos } from './onboardingMockData';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const ACTIVE_REPO_KEY = 'tl.activeRepoId';

export class ReposApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReposApiError';
  }
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function mockRepos(): GitHubRepoSummary[] {
  return githubRepos.map(repo => ({
    githubRepoId: Number(repo.id),
    fullName: repo.fullName,
    name: repo.name,
    owner: repo.org,
    private: repo.private,
    defaultBranch: repo.branch,
    htmlUrl: `https://github.com/${repo.fullName}`,
    isCloned: false,
  }));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new ReposApiError('VITE_API_BASE_URL is not configured.');
  }

  const headers: Record<string, string> = {};
  if (init?.headers) {
    Object.assign(headers, init.headers);
  }
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    throw new ReposApiError(`${path} failed (${res.status} ${res.statusText})`);
  }

  return (await res.json()) as T;
}

export function saveActiveRepoId(repoId: string) {
  try {
    localStorage.setItem(ACTIVE_REPO_KEY, repoId);
  } catch {
    // Ignore storage failures; the current flow can still continue in memory.
  }
}

export async function listGitHubRepos(): Promise<GitHubRepoSummary[]> {
  if (!API_BASE) {
    await delay(250);
    return mockRepos();
  }
  return request<GitHubRepoSummary[]>('/api/repos');
}

export async function connectRepo(githubRepoId: number): Promise<ConnectedRepo> {
  if (!API_BASE) {
    await delay(700);
    const repo = mockRepos().find(item => item.githubRepoId === githubRepoId) ?? mockRepos()[0];
    const connected = {
      repoId: String(repo.githubRepoId),
      repo: {
        name: repo.name,
        path: `/mock/workspaces/${repo.fullName}`,
        branch: repo.defaultBranch,
        commit: 'mock',
      },
    };
    saveActiveRepoId(connected.repoId);
    return connected;
  }

  const connected = await request<ConnectedRepo>(`/api/repos/${githubRepoId}/connect`, { method: 'POST' });
  saveActiveRepoId(connected.repoId);
  return connected;
}

export async function listRepoFiles(repoId: string, path = ''): Promise<RepoFileNode[]> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await request<{ nodes: RepoFileNode[] }>(`/api/repos/${repoId}/files${suffix}`);
  return result.nodes;
}

export async function readRepoFile(repoId: string, path: string): Promise<RepoFileContent> {
  const params = new URLSearchParams({ path });
  return request<RepoFileContent>(`/api/repos/${repoId}/file?${params.toString()}`);
}
