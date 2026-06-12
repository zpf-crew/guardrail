import type { GitHubRepoSummary } from './repos.types.js';

interface GitHubRepoApiResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
  owner: { login: string };
}

export function mapGithubRepo(repo: GitHubRepoApiResponse): GitHubRepoSummary & { cloneUrl: string } {
  return {
    githubRepoId: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    private: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
  };
}

export async function listGithubRepos(accessToken: string): Promise<Array<GitHubRepoSummary & { cloneUrl: string }>> {
  const url = new URL('https://api.github.com/user/repos');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('affiliation', 'owner,collaborator,organization_member');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'guardrail',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub repos request failed (${response.status})`);
  }

  const repos = (await response.json()) as GitHubRepoApiResponse[];
  return repos.map(mapGithubRepo);
}
