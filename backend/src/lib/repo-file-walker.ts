import { readdir } from 'node:fs/promises';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.artifacts',
]);

/** Walk a repository tree using Node fs APIs (same approach as onboarding scan). */
export async function walkRepositoryFiles(
  root: string,
  dir = '',
  acc: string[] = [],
  limit = 6000,
): Promise<string[]> {
  if (acc.length >= limit) return acc;
  const abs = path.join(root, dir);
  const entries = await readdir(abs, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (acc.length >= limit) break;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walkRepositoryFiles(root, path.join(dir, entry.name), acc, limit);
      }
      continue;
    }
    if (entry.isFile()) {
      acc.push(path.join(dir, entry.name).replaceAll(path.sep, '/'));
    }
  }

  return acc;
}
