import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RepoFileNode } from './repos.types.js';

async function resolveInside(root: string, relativePath = ''): Promise<string> {
  const rootReal = await realpath(root);
  const target = path.resolve(rootReal, relativePath);
  const targetReal = await realpath(target);
  const relative = path.relative(rootReal, targetReal);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes repository clone');
  }
  return targetReal;
}

function toRepoPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

export async function listRepoFiles(clonePath: string, relativePath = ''): Promise<RepoFileNode[]> {
  const directory = await resolveInside(clonePath, relativePath);
  const entries = await readdir(directory, { withFileTypes: true });
  const nodes = await Promise.all(entries
    .filter(entry => entry.name !== '.git')
    .map(async entry => {
      const childRelative = path.join(relativePath, entry.name);
      const childPath = path.join(directory, entry.name);
      const info = await stat(childPath);
      return {
        name: entry.name,
        path: toRepoPath(childRelative),
        type: entry.isDirectory() ? 'directory' as const : 'file' as const,
        size: entry.isFile() ? info.size : undefined,
      };
    }));
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readRepoFile(clonePath: string, relativePath: string): Promise<{ content: string; size: number }> {
  const filePath = await resolveInside(clonePath, relativePath);
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error('Path is not a file');
  }
  if (info.size > 1024 * 1024) {
    throw new Error('File is too large to read through this endpoint');
  }
  return { content: await readFile(filePath, 'utf8'), size: info.size };
}
