import { randomUUID } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
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

export class WorkbenchArtifactStore {
  private readonly rootDir: string;
  private readonly artifacts = new Map<string, RegisteredArtifact>();

  constructor(options: { rootDir?: string } = {}) {
    this.rootDir = options.rootDir ?? path.join(process.cwd(), '.artifacts', 'workbench');
  }

  async registerEvidence(input: RegisterEvidenceInput): Promise<Evidence> {
    if (input.evidence.kind !== 'screenshot') return input.evidence;

    const sourcePath = extractLocalPath(input.evidence.href);
    if (!sourcePath) return { ...input.evidence, href: undefined };

    const ext = extensionFor(sourcePath);
    const artifactId = `${randomUUID()}${ext}`;
    const dir = path.join(this.rootDir, input.sessionId, input.jobId);
    const filePath = path.join(dir, artifactId);

    try {
      await mkdir(dir, { recursive: true });
      await copyFile(sourcePath, filePath);
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
  return candidate;
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
