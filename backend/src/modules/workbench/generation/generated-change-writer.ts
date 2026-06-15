import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import type { GeneratedChange } from '../workbench.types.js';

export interface MaterializedChange {
  path: string;
  action: GeneratedChange['action'];
}

function contentFor(change: GeneratedChange): string {
  if (change.content !== undefined) return change.content;
  const lines = change.diff
    .filter(line => line.kind === 'add' || line.kind === 'context')
    .map(line => line.text);
  if (lines.length === 0) {
    throw new Error(`Generated change is missing materialized content: ${change.file}`);
  }
  return `${lines.join('\n')}\n`;
}

function resolveInsideRoot(rootDir: string, file: string): string {
  const root = resolve(rootDir);
  const target = resolve(root, file);
  const rel = relative(root, target);
  if (rel.startsWith('..') || rel === '' || resolve(rel) === rel) {
    throw new Error(`Generated change path escapes repository root: ${file}`);
  }
  return target;
}

export async function materializeGeneratedChanges(
  rootDir: string,
  changes: GeneratedChange[],
): Promise<MaterializedChange[]> {
  const written: MaterializedChange[] = [];
  for (const change of changes) {
    if (change.action === 'Delete') {
      throw new Error(`Deleting generated files is not supported for workbench apply: ${change.file}`);
    }
    const target = resolveInsideRoot(rootDir, change.file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contentFor(change), 'utf8');
    written.push({ path: change.file, action: change.action });
  }
  return written;
}
