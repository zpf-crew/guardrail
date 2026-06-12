import * as React from 'react';
import type { WorkbenchSession, IntentInput } from '@/types/testlens';
import {
  createWorkbenchSession,
  analyzeSession,
  planSession,
  runSession,
} from '@/data/workbench-api';

export type WorkbenchStatus = 'loading' | 'error' | 'ready';
export type PendingTransition = null | 'analyze' | 'plan' | 'run';

export interface UseWorkbenchResult {
  status: WorkbenchStatus;
  error: string | null;
  session: WorkbenchSession | null;
  currentStep: number;
  pending: PendingTransition;
  /** Tests executed so far (drives the S5 progress bar = ran / total). */
  ranTests: number;
  /** True while the run is in flight. */
  running: boolean;
  /** Generation timeline items completed (S4 animation). */
  genStep: number;
  /** True once the generation animation has finished. */
  genComplete: boolean;
  /** True once the user has applied the change set (terminal). */
  applied: boolean;
  apply: () => void;
  setStep: (i: number) => void;
  updateIntent: (patch: Partial<IntentInput>) => void;
  analyze: () => Promise<void>;
  generatePlan: () => Promise<void>;
  approvePlan: () => void;
  runTests: () => void;
}

/**
 * Drives the 6-step workbench: loads the session through the seam, holds the
 * editable intent, and advances steps by calling the seam and merging the
 * returned contract slice into the session.
 */
export function useWorkbench(initialIntent?: Partial<IntentInput>): UseWorkbenchResult {
  const [status, setStatus] = React.useState<WorkbenchStatus>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<WorkbenchSession | null>(null);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [pending, setPending] = React.useState<PendingTransition>(null);
  const [ranTests, setRanTests] = React.useState(0);
  // Number of generation timeline items completed (drives the S4 animation).
  const [genStep, setGenStep] = React.useState(0);
  const [applied, setApplied] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const genIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    createWorkbenchSession(initialIntent)
      .then(s => {
        if (cancelled) return;
        setSession(s);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to start workbench.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
    };
    // initialIntent is read once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateIntent = React.useCallback((patch: Partial<IntentInput>) => {
    setSession(s => (s ? { ...s, intent: { ...s.intent, ...patch } } : s));
  }, []);

  const analyze = React.useCallback(async () => {
    if (!session) return;
    setPending('analyze');
    try {
      const isolation = await analyzeSession(session.id);
      setSession(s => (s ? { ...s, isolation } : s));
      setCurrentStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyze failed.');
    } finally {
      setPending(null);
    }
  }, [session]);

  const generatePlan = React.useCallback(async () => {
    if (!session) return;
    setPending('plan');
    try {
      const plan = await planSession(session.id);
      setSession(s => (s ? { ...s, plan } : s));
      setCurrentStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan generation failed.');
    } finally {
      setPending(null);
    }
  }, [session]);

  const approvePlan = React.useCallback(() => {
    setCurrentStep(3);
    const total = session?.generation?.timeline.length ?? 0;
    if (genIntervalRef.current) clearInterval(genIntervalRef.current);
    setGenStep(0);
    if (total === 0) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setGenStep(i);
      if (i >= total) {
        clearInterval(id);
        if (genIntervalRef.current === id) genIntervalRef.current = null;
      }
    }, 320);
    genIntervalRef.current = id;
  }, [session]);

  const runTests = React.useCallback(() => {
    if (!session) return;
    // Clear any in-flight run so a re-trigger never leaves an orphaned interval.
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrentStep(4); // show the Run step immediately
    setPending('run');
    setRanTests(0);

    if (session.run) {
      // Results already available (mock): tick the bar by tests-run / total.
      const total = session.run.matrix.length;
      let ran = 0;
      const id = setInterval(() => {
        ran += 1;
        setRanTests(ran);
        if (ran >= total) {
          clearInterval(id);
          if (intervalRef.current === id) intervalRef.current = null;
          setPending(null);
        }
      }, 280);
      intervalRef.current = id;
    } else {
      // Real API: POST and await the single TestRunResult (no per-test stream yet).
      runSession(session.id)
        .then(run => { setSession(s => (s ? { ...s, run } : s)); setRanTests(run.matrix.length); })
        .catch(e => setError(e instanceof Error ? e.message : 'Run failed.'))
        .finally(() => setPending(null));
    }
  }, [session]);

  const genComplete = session?.generation ? genStep >= session.generation.timeline.length : false;
  const apply = React.useCallback(() => setApplied(true), []);

  return {
    status, error, session, currentStep, pending, ranTests, running: pending === 'run', genStep, genComplete,
    applied, apply,
    setStep: setCurrentStep, updateIntent, analyze, generatePlan, approvePlan, runTests,
  };
}
