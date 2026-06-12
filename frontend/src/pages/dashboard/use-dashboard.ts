import * as React from 'react';
import type { DashboardPayload } from '@/types/testlens';
import { getDashboard } from '@/data/dashboard-api';

export type DashboardStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface UseDashboardResult {
  status: DashboardStatus;
  data: DashboardPayload | null;
  error: string | null;
  /** Re-run the fetch (e.g. after a scan, or from the error retry button). */
  refetch: () => void;
}

/**
 * Loads the dashboard payload through the data seam and exposes a small status
 * machine: loading → (ready | empty | error). `empty` means no scan has run yet.
 */
export function useDashboard(): UseDashboardResult {
  const [status, setStatus] = React.useState<DashboardStatus>('loading');
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    getDashboard()
      .then(payload => {
        if (cancelled) return;
        setData(payload);
        const isEmpty = !payload.lastScanAt || payload.testCases.length === 0;
        setStatus(isEmpty ? 'empty' : 'ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refetch = React.useCallback(() => setNonce(n => n + 1), []);

  return { status, data, error, refetch };
}
