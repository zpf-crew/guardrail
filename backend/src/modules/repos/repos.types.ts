export interface GitHubRepoSummary {
  githubRepoId: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  repoId?: string;
  status?: string;
  isCloned?: boolean;
  clonePath?: string;
  currentBranch?: string;
  commitSha?: string;
  lastClonedAt?: string;
}

export interface RepoRecord {
  id: string;
  githubRepoId: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  clonePath: string | null;
  currentBranch: string | null;
  commitSha: string | null;
  status: string;
  lastClonedAt: string | null;
}

export interface RepoFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}
