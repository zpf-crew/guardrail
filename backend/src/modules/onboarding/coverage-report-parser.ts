import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { FileCoverage } from './onboarding.types.js';

/**
 * Reads per-file coverage from a clone's `coverage/` directory.
 *
 * Coverage commands only print a single repo-level number to stdout; the per-file breakdown lives in
 * the JSON reports the reporters write. We prefer `coverage-summary.json` (ready-made percentages) and
 * fall back to `coverage-final.json` (istanbul hit maps we turn into percentages). Returns [] when no
 * machine-readable report exists, so callers can render "not measured" honestly.
 */
export async function readFileCoverage(clonePath: string): Promise<FileCoverage[]> {
  const coverageDir = path.join(clonePath, 'coverage');

  const summaryRaw = await readFile(path.join(coverageDir, 'coverage-summary.json'), 'utf8').catch(() => null);
  if (summaryRaw) {
    const files = parseCoverageSummaryJson(summaryRaw, clonePath);
    if (files.length) return files;
  }

  const finalRaw = await readFile(path.join(coverageDir, 'coverage-final.json'), 'utf8').catch(() => null);
  if (finalRaw) {
    return parseCoverageFinalJson(finalRaw, clonePath);
  }

  return [];
}

/** istanbul `json-summary` reporter: each file entry already carries `lines.pct` / `branches.pct`. */
export function parseCoverageSummaryJson(raw: string, cloneRoot: string): FileCoverage[] {
  const data = safeParse(raw);
  if (!data) return [];
  const files: FileCoverage[] = [];
  for (const [key, entry] of Object.entries(data)) {
    if (key === 'total' || !entry || typeof entry !== 'object') continue;
    const record = entry as { lines?: { pct?: unknown }; branches?: { pct?: unknown } };
    const line = Number(record.lines?.pct);
    if (!Number.isFinite(line)) continue;
    const branch = Number(record.branches?.pct);
    files.push({ path: toRelativePosix(key, cloneRoot), line: clampPct(line), branch: Number.isFinite(branch) ? clampPct(branch) : clampPct(line) });
  }
  return files;
}

/** istanbul `json` reporter: compute percentages from statement (`s`) and branch (`b`) hit maps. */
export function parseCoverageFinalJson(raw: string, cloneRoot: string): FileCoverage[] {
  const data = safeParse(raw);
  if (!data) return [];
  const files: FileCoverage[] = [];
  for (const [key, entry] of Object.entries(data)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { path?: string; s?: Record<string, number>; b?: Record<string, number[]> };
    if (!record.s) continue;
    const statementHits = Object.values(record.s);
    const lineCovered = statementHits.filter(hit => hit > 0).length;
    const branchArms = Object.values(record.b ?? {}).flat();
    const branchCovered = branchArms.filter(hit => hit > 0).length;
    files.push({
      path: toRelativePosix(record.path ?? key, cloneRoot),
      line: clampPct(percentage(lineCovered, statementHits.length)),
      branch: clampPct(percentage(branchCovered, branchArms.length)),
    });
  }
  return files;
}

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function percentage(covered: number, total: number): number {
  return total > 0 ? (covered / total) * 100 : 0;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Normalize an absolute or relative report path to a clone-root-relative POSIX path for module matching. */
function toRelativePosix(filePath: string, cloneRoot: string): string {
  const relative = path.isAbsolute(filePath) ? path.relative(cloneRoot, filePath) : filePath;
  return relative.split(path.sep).join('/');
}
