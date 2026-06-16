import type {
  DashboardPayload,
  KnowledgeDoc,
  OnboardingDraft,
  QCTestCase,
  ScanLogEntry,
  ScanSummary,
  UploadedFile,
} from '@/types/testlens';
import { postScanStream, type ScanStreamProgress } from './scan-stream';

const LATEST_DASHBOARD_PREFIX = 'tl.latestDashboard.';

export type KnowledgeDocWithSnippet = KnowledgeDoc & {
  file: UploadedFile & { snippet?: string };
};

export interface OnboardingCommitResponse {
  jobId: string;
  summary: ScanSummary;
  logs: ScanLogEntry[];
  dashboard: DashboardPayload;
}

export class OnboardingApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingApiError';
  }
}

export function saveLatestDashboard(repoId: string, dashboard: DashboardPayload) {
  try {
    localStorage.setItem(`${LATEST_DASHBOARD_PREFIX}${repoId}`, JSON.stringify(dashboard));
  } catch {
    // Dashboard can still refetch from the API; local fallback is best effort.
  }
}

export function getLatestDashboard(repoId: string | null): DashboardPayload | null {
  if (!repoId) return null;
  try {
    const raw = localStorage.getItem(`${LATEST_DASHBOARD_PREFIX}${repoId}`);
    return raw ? JSON.parse(raw) as DashboardPayload : null;
  } catch {
    return null;
  }
}

export function clearLatestDashboard(repoId: string | null) {
  if (!repoId) return;
  try {
    localStorage.removeItem(`${LATEST_DASHBOARD_PREFIX}${repoId}`);
  } catch {
    // Local cache cleanup is best effort; the server reset is authoritative.
  }
}

export async function commitOnboardingScan(
  repoId: string,
  draft: Partial<OnboardingDraft>,
  onProgress: (progress: ScanStreamProgress) => void = () => {},
): Promise<OnboardingCommitResponse> {
  const result = await postScanStream(
    `/api/repos/${encodeURIComponent(repoId)}/onboarding/commit`,
    draft,
    onProgress,
  ) as OnboardingCommitResponse;
  saveLatestDashboard(repoId, result.dashboard);
  return result;
}

export function toUploadedFile(file: File, snippet?: string): UploadedFile & { snippet?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
  const type = ['pdf', 'md', 'txt', 'csv', 'xlsx', 'json'].includes(ext) ? ext as UploadedFile['type'] : 'txt';
  const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return { name: file.name, type, size, bytes: file.size, snippet };
}

export function normalizeQCPriority(value: string): QCTestCase['priority'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Medium';
}
