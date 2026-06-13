import * as React from 'react';
import type { WorkbenchSession, IntentInput, Evidence } from '@/types/testlens';
import {
  createWorkbenchSession,
  updateWorkbenchIntent,
  analyzeSession,
  planSession,
  generateSession,
  runSession,
  reviewSession,
} from '@/data/workbench-api';
import type { JobEvent } from '@/data/workbench-api';

export type WorkbenchStatus = 'loading' | 'error' | 'ready';
export type PendingTransition = null | 'analyze' | 'plan' | 'generate' | 'run' | 'review';
export type RunProgressEvent = Extract<JobEvent, { type: 'progress' | 'thinking' | 'error' | 'status' }>;

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
  /** Raw events emitted by the latest run job. */
  runEvents: JobEvent[];
  /** Run events suitable for progress display. */
  runProgress: RunProgressEvent[];
  /** Evidence artifacts emitted by the latest run job. */
  runEvidence: Evidence[];
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
  const [runEvents, setRunEvents] = React.useState<JobEvent[]>([]);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const genIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = React.useRef(0);

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
      const updated = await updateWorkbenchIntent(session.id, session.intent);
      setSession(updated);
      const isolation = await analyzeSession(updated.id);
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

  const startGenerationAnimation = React.useCallback((total: number) => {
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
  }, []);

  const approvePlan = React.useCallback(() => {
    if (!session) return;
    setCurrentStep(3);
    setPending('generate');
    generateSession(session.id)
      .then(generation => {
        setSession(s => (s ? { ...s, generation } : s));
        startGenerationAnimation(generation.timeline.length);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Generation failed.'))
      .finally(() => setPending(null));
  }, [session, startGenerationAnimation]);

  const startRunAnimation = React.useCallback((total: number) => new Promise<void>(resolve => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRanTests(0);
    if (total === 0) {
      resolve();
      return;
    }

    let ran = 0;
    const id = setInterval(() => {
      ran += 1;
      setRanTests(ran);
      if (ran >= total) {
        clearInterval(id);
        if (intervalRef.current === id) intervalRef.current = null;
        resolve();
      }
    }, 280);
    intervalRef.current = id;
  }), []);

  const runTests = React.useCallback(() => {
    if (!session) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const isCurrentRun = () => runIdRef.current === runId;

    // Clear any in-flight run so a re-trigger never leaves an orphaned interval.
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrentStep(4); // show the Run step immediately
    setPending('run');
    setRanTests(0);
    setRunEvents([]);

    void (async () => {
      try {
        const run = await runSession(session.id, event => {
          if (!isCurrentRun()) return;
          setRunEvents(events => [...events, event]);
        });
        if (!isCurrentRun()) return;

        setSession(s => (s ? { ...s, run } : s));
        const animation = startRunAnimation(run.matrix.length);
        setPending('review');
        const [review] = await Promise.all([reviewSession(session.id), animation]);
        if (!isCurrentRun()) return;

        setSession(s => (s ? { ...s, review } : s));
        setPending(null);
      } catch (e) {
        if (!isCurrentRun()) return;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setPending(null);
        setError(e instanceof Error ? e.message : 'Run failed.');
      }
    })();
  }, [session, startRunAnimation]);

  const genComplete = session?.generation ? genStep >= session.generation.timeline.length : false;
  const apply = React.useCallback(() => setApplied(true), []);
  const runProgress = React.useMemo(
    () => runEvents.filter((event): event is RunProgressEvent =>
      event.type === 'progress' || event.type === 'thinking' || event.type === 'error' || event.type === 'status',
    ),
    [runEvents],
  );
  const streamedRunEvidence = React.useMemo(
    () => runEvents.flatMap(event => {
      if (event.type === 'screenshot' || event.type === 'artifact') return [event.artifact];
      return [];
    }),
    [runEvents],
  );
  const runEvidence = React.useMemo(() => {
    if (streamedRunEvidence.length > 0) return streamedRunEvidence;
    return [
      ...(session?.run?.ui?.evidence ?? []),
      ...(session?.run?.mobile?.evidence ?? []),
    ];
  }, [session?.run?.mobile?.evidence, session?.run?.ui?.evidence, streamedRunEvidence]);

  return {
    status, error, session, currentStep, pending, ranTests, running: pending === 'run' || pending === 'review', genStep, genComplete,
    applied, runEvents, runProgress, runEvidence, apply,
    setStep: setCurrentStep, updateIntent, analyze, generatePlan, approvePlan, runTests,
  };
}
