import type {
  DashboardPayload,
  KnowledgeDoc,
  OnboardingDraft,
  QCTestCase,
  ScanLogEntry,
  ScanSummary,
  UploadedFile,
} from '@/types/testlens';
import { mockDashboard } from './dashboardMockData';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const LATEST_DASHBOARD_PREFIX = 'tl.latestDashboard.';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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

function mockSummaryFromDraft(draft: Partial<OnboardingDraft>): ScanSummary {
  const qcCasesImported = draft.qcPreview?.length ?? 0;
  const productDocsIndexed = (draft.productDocs?.length ?? 0) + (draft.docSources?.length ?? 0);
  return {
    automatedTestsFound: mockDashboard.testCases.filter(test => test.status !== 'missing').length,
    qcCasesImported,
    productDocsIndexed,
    missingRecommended: Math.max(3, draft.qcPreview?.filter(row => row.automationStatus !== 'automated').length ?? 0),
    suspiciousTests: productDocsIndexed ? 2 : 0,
    failedTests: mockDashboard.metrics.failed.value,
    flakyTests: mockDashboard.metrics.flaky.value,
    coverage: mockDashboard.metrics.coverage.value,
  };
}

function mockDashboardFromDraft(draft: Partial<OnboardingDraft>): DashboardPayload {
  return {
    ...mockDashboard,
    lastScanAt: new Date().toISOString(),
    metrics: {
      ...mockDashboard.metrics,
      missing: { ...mockDashboard.metrics.missing, value: Math.max(3, draft.qcPreview?.filter(row => row.automationStatus !== 'automated').length ?? 0) },
      suspicious: { ...mockDashboard.metrics.suspicious, value: (draft.productDocs?.length || draft.docSources?.length) ? 2 : 0 },
    },
    activity: [
      { id: 'A-1', state: 'done', title: `Scanned repository ${mockDashboard.repo.name}`, at: new Date().toISOString(), detail: `${mockDashboard.filesIndexed.toLocaleString()} files indexed` },
      { id: 'A-2', state: 'done', title: 'Imported product knowledge and QC cases', at: new Date().toISOString(), detail: `${draft.productDocs?.length ?? 0} docs · ${draft.qcPreview?.length ?? 0} QC cases` },
      ...mockDashboard.activity.slice(2),
    ],
  };
}

export async function commitOnboardingScan(repoId: string, draft: Partial<OnboardingDraft>): Promise<OnboardingCommitResponse> {
  if (!API_BASE) {
    await delay(1800);
    const dashboard = mockDashboardFromDraft(draft);
    saveLatestDashboard(repoId, dashboard);
    return {
      jobId: 'mock-onboarding-scan',
      summary: mockSummaryFromDraft(draft),
      logs: [],
      dashboard,
    };
  }

  const res = await fetch(`${API_BASE}/api/repos/${encodeURIComponent(repoId)}/onboarding/commit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });

  if (!res.ok) {
    throw new OnboardingApiError(`Initial scan failed (${res.status} ${res.statusText})`);
  }

  const result = await res.json() as OnboardingCommitResponse;
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
