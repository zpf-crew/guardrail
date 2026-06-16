import * as React from 'react';
import type { ScanLogEntry, ScanSummary } from '@/types/testlens';
import type { ScanStreamProgress } from '@/data/scan-stream';

/** A log line shown in the scan overlay feed. */
export interface ScanProgressLog {
  tag: 'ok' | 'warn' | 'info';
  message: string;
  at?: string;
}

/** What a scan trigger resolves to; the real logs/summary replace the live feed on completion. */
export interface ScanRunResult {
  summary?: ScanSummary;
  logs?: ScanLogEntry[];
}

export interface UseScanProgress {
  running: boolean;
  complete: boolean;
  error: string | null;
  progress: number;
  stepLabel: string;
  eta: string;
  logs: ScanProgressLog[];
  summary: ScanSummary | null;
  start: () => Promise<void>;
  dismiss: () => void;
}

/**
 * Drives the scan-progress overlay from the backend's real SSE progress events: each `progress` event
 * advances the bar and appends a log line; the final result swaps in the full server logs + summary.
 */
export function useScanProgress(
  runScan: (onProgress: (progress: ScanStreamProgress) => void) => Promise<ScanRunResult>,
): UseScanProgress {
  const [running, setRunning] = React.useState(false);
  const [complete, setComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [stepLabel, setStepLabel] = React.useState('Preparing…');
  const [eta, setEta] = React.useState('');
  const [logs, setLogs] = React.useState<ScanProgressLog[]>([]);
  const [summary, setSummary] = React.useState<ScanSummary | null>(null);

  const start = React.useCallback(async () => {
    if (running) return;
    setRunning(true);
    setComplete(false);
    setError(null);
    setProgress(0);
    setStepLabel('Preparing…');
    setEta('');
    setLogs([]);
    setSummary(null);
    try {
      const result = await runScan(progressEvent => {
        setProgress(progressEvent.percent);
        setStepLabel(progressEvent.message);
        setLogs(prev => [...prev, { tag: progressEvent.level ?? 'info', message: progressEvent.message, at: progressEvent.at }]);
      });
      setProgress(100);
      setStepLabel('Complete');
      setEta('done');
      setComplete(true);
      if (result.summary) setSummary(result.summary);
      // Keep the streamed feed (accurate per-step times) rather than the end-stamped server logs.
      setLogs(prev => [...prev, { tag: 'ok', message: 'Scan complete', at: new Date().toISOString() }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStepLabel('Scan failed');
      setEta('');
    } finally {
      setRunning(false);
    }
  }, [running, runScan]);

  const dismiss = React.useCallback(() => {
    setComplete(false);
    setError(null);
    setProgress(0);
    setStepLabel('Preparing…');
    setEta('');
    setLogs([]);
    setSummary(null);
  }, []);

  return { running, complete, error, progress, stepLabel, eta, logs, summary, start, dismiss };
}
