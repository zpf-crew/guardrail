import type { DashboardPayload, ScanLogEntry, ScanSummary } from '@/types/testlens';
import { getApiBase } from './api-base';

export interface ScanStreamProgress {
  message: string;
  percent: number;
  level?: 'info' | 'ok' | 'warn';
  /** ISO timestamp of when this step happened. */
  at?: string;
}

export interface ScanStreamResult {
  jobId: string;
  summary: ScanSummary;
  logs: ScanLogEntry[];
  dashboard: DashboardPayload;
}

/**
 * POSTs to a scan SSE endpoint and forwards real `progress` events to `onProgress`, resolving with the
 * final `result`. Replaces the old fake-timer progress with the backend's actual stage updates.
 */
export async function postScanStream(
  path: string,
  body: unknown | undefined,
  onProgress: (progress: ScanStreamProgress) => void,
): Promise<ScanStreamResult> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // The endpoint may reply with a JSON error (404/422) before any stream starts.
    let message = `Scan failed (${res.status} ${res.statusText})`;
    try {
      const data = await res.json() as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // keep the status-based message
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('Scan stream is not available.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ScanStreamResult | null = null;
  let errorMessage: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventType = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!data) {
        boundary = buffer.indexOf('\n\n');
        continue;
      }

      const parsed = JSON.parse(data);
      if (eventType === 'progress') onProgress(parsed as ScanStreamProgress);
      else if (eventType === 'result') result = parsed as ScanStreamResult;
      else if (eventType === 'error') errorMessage = (parsed as { message?: string }).message ?? 'Scan failed';

      boundary = buffer.indexOf('\n\n');
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!result) throw new Error('Scan ended without a result.');
  return result;
}
