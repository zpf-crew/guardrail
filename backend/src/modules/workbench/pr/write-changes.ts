import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import type { GeneratedChange } from '../workbench.types.js';

/** Reconstruct a file's content from a change's diff. The `add` lines carry the generated content. */
function contentFromChanges(changes: GeneratedChange[]): string {
  const lines: string[] = [];
  for (const change of changes) {
    for (const line of change.diff) {
      if (line.kind === 'add') lines.push(line.text);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Resolve a change's target path inside the clone, rejecting any path that escapes the clone root. */
function resolveSafeTarget(cloneRoot: string, relativePath: string): string {
  const root = path.resolve(cloneRoot);
  const target = path.resolve(root, relativePath);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error(`Refusing to write outside the repository: ${relativePath}`);
  }
  return target;
}

/**
 * Writes the generated changes into the clone working tree. Groups changes by target file (a file may
 * have several), reconstructs content from the diff, and applies adds/updates by writing and deletes by
 * removing. Returns the relative paths touched, so the caller can stage exactly those.
 */
export async function writeChangesToClone(cloneRoot: string, changes: GeneratedChange[]): Promise<string[]> {
  const byFile = new Map<string, GeneratedChange[]>();
  for (const change of changes) {
    const list = byFile.get(change.file) ?? [];
    list.push(change);
    byFile.set(change.file, list);
  }

  const touched: string[] = [];
  for (const [file, fileChanges] of byFile) {
    const target = resolveSafeTarget(cloneRoot, file);
    const isDelete = fileChanges.every(change => change.action === 'Delete');
    if (isDelete) {
      await rm(target, { force: true });
    } else {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contentFromChanges(fileChanges), 'utf8');
    }
    touched.push(file);
  }
  return touched;
}
