import { runGit, authenticatedCloneUrl } from '../../repos/git-clone.service.js';
import type { GeneratedChange } from '../workbench.types.js';
import { writeChangesToClone } from './write-changes.js';

const COMMIT_AUTHOR_NAME = 'Guardrail';
const COMMIT_AUTHOR_EMAIL = 'guardrail@users.noreply.github.com';

export interface CreatePullRequestInput {
  clonePath: string;
  cloneUrl: string;
  fullName: string;           // "owner/repo"
  baseBranch: string;
  accessToken: string;
  changes: GeneratedChange[];
  title: string;
  body: string;
}

export interface CreatePullRequestResult {
  url: string;
  branch: string;
}

function branchName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `guardrail/add-tests-${stamp}`;
}

async function createGithubPr(input: {
  fullName: string;
  accessToken: string;
  head: string;
  base: string;
  title: string;
  body: string;
}): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${input.fullName}/pulls`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.accessToken}`,
      'User-Agent': 'guardrail',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: input.title, body: input.body, head: input.head, base: input.base }),
  });

  const payload = (await response.json().catch(() => ({}))) as { html_url?: string; message?: string; errors?: unknown };
  if (!response.ok || !payload.html_url) {
    const detail = payload.message ?? `GitHub API error (${response.status})`;
    throw new Error(`Failed to open pull request: ${detail}`);
  }
  return payload.html_url;
}

/**
 * Writes the generated test changes into the clone, commits them to a fresh branch, pushes that branch
 * to GitHub (auth via the user's token), and opens a pull request against the base branch. Returns the
 * PR URL. The base branch checkout is left untouched — work happens on the new branch only.
 */
export async function createPullRequest(input: CreatePullRequestInput): Promise<CreatePullRequestResult> {
  if (!input.changes.length) {
    throw new Error('No generated changes to open a pull request for.');
  }

  const branch = branchName();
  const pushUrl = authenticatedCloneUrl(input.cloneUrl, input.accessToken);

  // Branch from the current checkout, write + stage exactly the changed files, commit, push.
  await runGit(['checkout', '-B', branch], input.clonePath);
  const touched = await writeChangesToClone(input.clonePath, input.changes);
  await runGit(['add', '--', ...touched], input.clonePath);

  const status = await runGit(['status', '--porcelain'], input.clonePath);
  if (!status.trim()) {
    await runGit(['checkout', input.baseBranch], input.clonePath);
    throw new Error('Generated changes produced no file differences to commit.');
  }

  await runGit(
    ['-c', `user.name=${COMMIT_AUTHOR_NAME}`, '-c', `user.email=${COMMIT_AUTHOR_EMAIL}`, 'commit', '-m', input.title],
    input.clonePath,
  );

  try {
    await runGit(['push', '--force-with-lease', pushUrl, `HEAD:refs/heads/${branch}`], input.clonePath);
    const url = await createGithubPr({
      fullName: input.fullName,
      accessToken: input.accessToken,
      head: branch,
      base: input.baseBranch,
      title: input.title,
      body: input.body,
    });
    return { url, branch };
  } finally {
    // Return the clone to the base branch so later scans/operations resume from a known state.
    await runGit(['checkout', input.baseBranch], input.clonePath).catch(() => undefined);
  }
}
