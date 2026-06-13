import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Evidence } from '../workbench.types.js';

export interface RegisteredArtifact {
  artifactId: string;
  sessionId: string;
  jobId: string;
  filePath: string;
  contentType: string;
}

export interface RegisterEvidenceInput {
  sessionId: string;
  jobId: string;
  evidence: Evidence;
}

export interface WorkbenchArtifactStoreOptions {
  rootDir?: string;
  allowedSourceRoots?: string[];
}

export class WorkbenchArtifactStore {
  private readonly rootDir: string;
  private readonly allowedSourceRoots: string[];
  private readonly artifacts = new Map<string, RegisteredArtifact>();

  constructor(options: WorkbenchArtifactStoreOptions = {}) {
    this.rootDir = path.resolve(options.rootDir ?? path.join(process.cwd(), '.artifacts', 'workbench'));
    this.allowedSourceRoots = (options.allowedSourceRoots ?? defaultAllowedSourceRoots()).map(root => path.resolve(root));
  }

  async registerEvidence(input: RegisterEvidenceInput): Promise<Evidence> {
    if (input.evidence.kind !== 'screenshot') return input.evidence;

    const sourcePath = extractLocalPath(input.evidence.href);
    if (!sourcePath) return { ...input.evidence, href: undefined };
    if (!isInsideAnyRoot(sourcePath, this.allowedSourceRoots)) return { ...input.evidence, href: undefined };
    if (!isSafePathSegment(input.sessionId) || !isSafePathSegment(input.jobId)) return { ...input.evidence, href: undefined };

    const resolvedSourcePath = await resolveAllowedSourcePath(sourcePath, this.allowedSourceRoots);
    if (!resolvedSourcePath) return { ...input.evidence, href: undefined };

    const ext = extensionFor(sourcePath);
    const artifactId = `${randomUUID()}${ext}`;
    const dir = path.join(this.rootDir, input.sessionId, input.jobId);
    const filePath = path.join(dir, artifactId);
    if (!isInsideRoot(filePath, this.rootDir)) return { ...input.evidence, href: undefined };

    try {
      await mkdir(dir, { recursive: true });
      await copyFile(resolvedSourcePath, filePath);
    } catch {
      return { ...input.evidence, href: undefined };
    }

    const artifact: RegisteredArtifact = {
      artifactId,
      sessionId: input.sessionId,
      jobId: input.jobId,
      filePath,
      contentType: contentTypeFor(ext),
    };
    this.artifacts.set(key(input.sessionId, artifactId), artifact);

    return {
      ...input.evidence,
      href: `/api/workbench/${input.sessionId}/artifacts/${artifactId}`,
    };
  }

  getArtifact(sessionId: string, artifactId: string): RegisteredArtifact | undefined {
    return this.artifacts.get(key(sessionId, artifactId));
  }
}

function key(sessionId: string, artifactId: string): string {
  return `${sessionId}:${artifactId}`;
}

function extractLocalPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const savedMatch = trimmed.match(/Screenshot saved to\s+(.+)$/i);
  const candidate = savedMatch?.[1]?.trim() ?? trimmed;
  if (!path.isAbsolute(candidate)) return undefined;
  return path.resolve(candidate);
}

function extensionFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.jpg' || ext === '.jpeg' || ext === '.webp' ? ext : '.png';
}

function contentTypeFor(ext: string): string {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function defaultAllowedSourceRoots(): string[] {
  return [os.tmpdir(), path.join(os.homedir(), '.agent-browser', 'tmp', 'screenshots')];
}

function isSafePathSegment(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function isInsideAnyRoot(filePath: string, roots: string[]): boolean {
  return roots.some(root => isInsideRoot(filePath, root));
}

function isInsideRoot(filePath: string, root: string): boolean {
  const relative = path.relative(root, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveAllowedSourcePath(sourcePath: string, allowedSourceRoots: string[]): Promise<string | undefined> {
  let resolvedSourcePath: string;
  try {
    resolvedSourcePath = await realpath(sourcePath);
  } catch {
    return undefined;
  }

  const resolvedRoots = await Promise.all(allowedSourceRoots.map(root => realpath(root).catch(() => undefined)));
  const existingRoots = resolvedRoots.filter((root): root is string => root !== undefined);
  return isInsideAnyRoot(resolvedSourcePath, existingRoots) ? resolvedSourcePath : undefined;
}
