import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, rm, symlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export interface UnitWorktreeLease {
  path: string;
  cleanup: () => Promise<void>;
}

async function symlinkIfExists(source: string, target: string): Promise<void> {
  const exists = await stat(source).then(info => info.isDirectory()).catch(() => false);
  if (!exists) return;
  await symlink(source, target, 'dir').catch(() => undefined);
}

export async function createUnitWorktree(repoRoot: string): Promise<UnitWorktreeLease> {
  const base = join(tmpdir(), 'guardrail-unit-worktrees');
  await mkdir(base, { recursive: true });
  const path = join(base, randomUUID());
  await execFile('git', ['worktree', 'add', '--detach', path], { cwd: repoRoot });
  await symlinkIfExists(join(repoRoot, 'node_modules'), join(path, 'node_modules'));

  return {
    path,
    cleanup: async () => {
      await execFile('git', ['worktree', 'remove', '--force', path], { cwd: repoRoot }).catch(async () => {
        await rm(path, { recursive: true, force: true });
      });
    },
  };
}
