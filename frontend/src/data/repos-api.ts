import type { ConnectedRepo, GitHubRepoSummary, RepoFileContent, RepoFileNode } from '@/types/testlens';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
const ACTIVE_REPO_KEY = 'tl.activeRepoId';

export class ReposApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReposApiError';
  }
}

function requireApiBase(): string {
  return API_BASE;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    Object.assign(headers, init.headers);
  }
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${requireApiBase()}${path}`, {
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
  return request<GitHubRepoSummary[]>('/api/repos');
}

export async function connectRepo(githubRepoId: number): Promise<ConnectedRepo> {
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
