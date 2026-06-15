import { getActiveRepoId } from './dashboard-api';
import type { ScanLogEntry, ScanSummary } from '@/types/testlens';

/**
 * Triggers a repository scan via `POST /api/repos/:repoId/scan`.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

export class ScanApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanApiError';
  }
}

function requireApiBase(): string {
  return API_BASE;
}

export interface StartScanResult {
  jobId: string;
  summary: ScanSummary;
  logs: ScanLogEntry[];
}

export async function startScan(repoId: string | null = getActiveRepoId()): Promise<StartScanResult> {
  if (!repoId) {
    throw new ScanApiError('No repository selected. Complete onboarding first.');
  }

  const res = await fetch(`${requireApiBase()}/api/repos/${encodeURIComponent(repoId)}/scan`, { method: 'POST', credentials: 'include' });
  if (!res.ok) {
    throw new ScanApiError(`Scan request failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as StartScanResult;
}
