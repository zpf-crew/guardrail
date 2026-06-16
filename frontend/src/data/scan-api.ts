import { getActiveRepoId } from './dashboard-api';
import { postScanStream, type ScanStreamProgress, type ScanStreamResult } from './scan-stream';

/**
 * Triggers a repository scan via `POST /api/repos/:repoId/scan`, streaming real progress events.
 */

export class ScanApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanApiError';
  }
}

export type StartScanResult = ScanStreamResult;

export async function startScan(
  onProgress: (progress: ScanStreamProgress) => void = () => {},
  repoId: string | null = getActiveRepoId(),
): Promise<StartScanResult> {
  if (!repoId) {
    throw new ScanApiError('No repository selected. Complete onboarding first.');
  }
  return postScanStream(`/api/repos/${encodeURIComponent(repoId)}/scan`, undefined, onProgress);
}
