import { getActiveRepoId } from './dashboard-api';

/**
 * Triggers a repository scan. Hackathon-simple: kicks off the scan and the
 * caller refetches the dashboard when it resolves (no live `ScanProgress`
 * streaming yet — that's a follow-up once the transport is finalized).
 *
 * - No `VITE_API_BASE_URL` → simulates a scan with a delay.
 * - Configured → `POST /api/repos/:repoId/scan` (contract §4).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class ScanApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanApiError';
  }
}

export interface StartScanResult {
  jobId: string;
}

export async function startScan(repoId: string | null = getActiveRepoId()): Promise<StartScanResult> {
  if (!API_BASE) {
    await delay(1200); // simulate scan duration
    return { jobId: 'mock-scan' };
  }

  if (!repoId) {
    throw new ScanApiError('No repository selected. Complete onboarding first.');
  }

  const res = await fetch(`${API_BASE}/api/repos/${encodeURIComponent(repoId)}/scan`, { method: 'POST' });
  if (!res.ok) {
    throw new ScanApiError(`Scan request failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as StartScanResult;
}
