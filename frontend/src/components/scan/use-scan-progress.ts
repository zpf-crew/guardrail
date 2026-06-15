import * as React from 'react';
import { onboardingScanTasks } from '@/data/onboarding-scan-ui';
import type { ScanLogEntry, ScanSummary } from '@/types/testlens';

/** A log line shown in the scan overlay feed. */
export interface ScanProgressLog {
  tag: 'ok' | 'warn' | 'info';
  message: string;
  at?: string;
}

/** What a scan trigger resolves to; the real logs/summary replace the animation on completion. */
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
 * Drives a scan-progress overlay: while a blocking scan request is in flight it animates through the
 * known scan steps (same labels as onboarding), then swaps in the real logs/summary when the request
 * resolves. Mirrors the onboarding scan UX without coupling to its page state.
 */
export function useScanProgress(runScan: () => Promise<ScanRunResult>): UseScanProgress {
  const [running, setRunning] = React.useState(false);
  const [complete, setComplete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [stepLabel, setStepLabel] = React.useState('Preparing…');
  const [eta, setEta] = React.useState('');
  const [logs, setLogs] = React.useState<ScanProgressLog[]>([]);
  const [summary, setSummary] = React.useState<ScanSummary | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const step = React.useCallback((index: number) => {
    const total = onboardingScanTasks.length;
    if (index >= total) {
      // Animation outran the request; hold near-complete until the real result lands.
      setProgress(96);
      setStepLabel('Generating initial testing insights');
      setEta('waiting for scan result');
      return;
    }
    setProgress(Math.round(((index + 0.5) / total) * 100));
    setStepLabel(onboardingScanTasks[index].label);
    setEta(`~${Math.max(1, total - index)}s remaining`);
    setLogs(prev => [...prev, { tag: onboardingScanTasks[index].warn ? 'warn' : 'info', message: onboardingScanTasks[index].label }]);
    timerRef.current = setTimeout(() => step(index + 1), 620 + Math.random() * 260);
  }, []);

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
    timerRef.current = setTimeout(() => step(0), 300);
    try {
      const result = await runScan();
      clearTimer();
      setProgress(100);
      setStepLabel('Complete');
      setEta('done');
      setComplete(true);
      if (result.summary) setSummary(result.summary);
      if (result.logs?.length) {
        setLogs(result.logs.map(log => ({ tag: log.level, message: log.message, at: log.at })));
      }
    } catch (e) {
      clearTimer();
      setError(e instanceof Error ? e.message : 'Scan failed');
      setStepLabel('Scan failed');
      setEta('');
    } finally {
      setRunning(false);
    }
  }, [running, runScan, step, clearTimer]);

  const dismiss = React.useCallback(() => {
    clearTimer();
    setComplete(false);
    setError(null);
    setProgress(0);
    setStepLabel('Preparing…');
    setEta('');
    setLogs([]);
    setSummary(null);
  }, [clearTimer]);

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  return { running, complete, error, progress, stepLabel, eta, logs, summary, start, dismiss };
}
