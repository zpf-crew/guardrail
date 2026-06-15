import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../../config/env.js';

export function runGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git exited with ${code}`));
      }
    });
  });
}

export function authenticatedCloneUrl(cloneUrl: string, token: string): string {
  const url = new URL(cloneUrl);
  url.username = 'x-access-token';
  url.password = token;
  return url.toString();
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

/**
 * Refreshes an existing shallow clone to the latest commit on its branch, so a re-scan reflects
 * pushed changes. When the commit actually moves, untracked build output (node_modules, coverage)
 * is wiped so dependencies reinstall against the new commit.
 */
export async function updateRepository(input: {
  clonePath: string;
  branch: string;
  cloneUrl: string;
  accessToken: string;
}): Promise<{ commitSha: string; changed: boolean }> {
  const before = await runGit(['rev-parse', 'HEAD'], input.clonePath).catch(() => '');
  // The clone embeds a possibly-stale token in its origin URL; refresh it with a current one.
  await runGit(['remote', 'set-url', 'origin', authenticatedCloneUrl(input.cloneUrl, input.accessToken)], input.clonePath);
  await runGit(['fetch', '--depth', '1', 'origin', input.branch], input.clonePath);
  await runGit(['reset', '--hard', `origin/${input.branch}`], input.clonePath);
  const commitSha = await runGit(['rev-parse', 'HEAD'], input.clonePath);
  const changed = before !== commitSha;
  if (changed) {
    await runGit(['clean', '-fdx'], input.clonePath);
  }
  return { commitSha, changed };
}

export async function cloneRepository(input: {
  userId: string;
  repoId: string;
  cloneUrl: string;
  defaultBranch: string;
  accessToken: string;
}): Promise<{ clonePath: string; branch: string; commitSha: string }> {
  const workspaceRoot = path.resolve(process.cwd(), env.WORKSPACE_DIR);
  const clonePath = path.join(workspaceRoot, safeSegment(input.userId), safeSegment(input.repoId));
  await mkdir(path.dirname(clonePath), { recursive: true });
  await rm(clonePath, { recursive: true, force: true });

  try {
    await runGit([
      'clone',
      '--depth',
      '1',
      '--branch',
      input.defaultBranch,
      authenticatedCloneUrl(input.cloneUrl, input.accessToken),
      clonePath,
    ]);
    const commitSha = await runGit(['rev-parse', 'HEAD'], clonePath);
    const branch = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], clonePath);
    return { clonePath, branch, commitSha };
  } catch (error) {
    await rm(clonePath, { recursive: true, force: true });
    throw error;
  }
}
