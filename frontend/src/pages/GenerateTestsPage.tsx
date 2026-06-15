import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { Evidence, FeatureModule, IntentInput, QuickAction, TestRunResult } from '@/types/testlens';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ArrowLeftIcon, WarningTriangleIcon, LoaderIcon } from '@/components/icons';
import { getDashboard } from '@/data/dashboard-api';
import {
  fallbackFeatureOptions,
  featureOptionsFromDashboard,
  quickActionsFromDashboard,
} from '@/data/workbench-intent-data';
import { primaryTestType } from '@/pages/generate-tests/workbench-presentation';
import { useWorkbench } from '@/pages/generate-tests/use-workbench';
import { WorkflowSidebar } from '@/pages/generate-tests/workflow-sidebar';
import { exportTestPlan } from '@/pages/generate-tests/export-test-plan';
import { isMockMode } from '@/data/mock-workbench';
import { createSessionPullRequest } from '@/data/workbench-api';
import { IntentStep } from '@/pages/generate-tests/steps/intent-step';
import { IsolationStep } from '@/pages/generate-tests/steps/isolation-step';
import { PlanStep } from '@/pages/generate-tests/steps/plan-step';
import { GenerateStep } from '@/pages/generate-tests/steps/generate-step';
import { RunStep } from '@/pages/generate-tests/steps/run-step';
import { ReviewStep } from '@/pages/generate-tests/steps/review-step';
import { useAuth } from '@/app/auth-context';

/** Insight handoff from the Dashboard (navigate('/tests', { state })). */
interface HandoffState {
  insightId?: string;
  action?: string;
}

function buildInitialIntent(
  state: HandoffState | null,
  quickActions: QuickAction[],
): Partial<IntentInput> | undefined {
  if (!state) return undefined;
  const qa = state.insightId ? quickActions.find(q => q.sourceInsightId === state.insightId) : undefined;
  return {
    prompt: qa?.label ?? state.action ?? '',
    ...(qa ? { feature: qa.feature } : {}),
    testTypes: ['UI / Browser'],
  };
}

const shellStyle = { fontFamily: 'var(--sans)' } as const;

function hasScreenshotHref(evidence: Evidence[]): boolean {
  return evidence.some(item => item.kind === 'screenshot' && Boolean(item.href));
}

function evidenceWithScreenshotFallback(streamedEvidence: Evidence[], run?: TestRunResult | null): Evidence[] {
  if (hasScreenshotHref(streamedEvidence) || !run) return streamedEvidence;

  const finalScreenshots = run.ui.evidence.filter(item => item.kind === 'screenshot' && item.href);

  return finalScreenshots.length ? [...streamedEvidence, ...finalScreenshots] : streamedEvidence;
}

export function GenerateTestsPage() {
  const location = useLocation();
  const handoffState = location.state as HandoffState | null;
  const [workbenchKey, setWorkbenchKey] = useState(0);
  const restoreSessionId = useMemo(
    () => new URLSearchParams(location.search).get('session'),
    // Re-read the URL only when explicitly starting a fresh workbench instance.
    [workbenchKey],
  );

  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [featureOptions, setFeatureOptions] = useState<FeatureModule[]>(fallbackFeatureOptions());
  const [intentDataReady, setIntentDataReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getDashboard()
      .then(dashboard => {
        if (cancelled) return;
        setQuickActions(quickActionsFromDashboard(dashboard));
        setFeatureOptions(featureOptionsFromDashboard(dashboard));
      })
      .catch(() => {
        if (cancelled) return;
        setQuickActions([]);
        setFeatureOptions(fallbackFeatureOptions());
      })
      .finally(() => {
        if (!cancelled) setIntentDataReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  if (!intentDataReady) {
    return (
      <div className="min-h-screen grid place-items-center text-[#98a1b3]" style={shellStyle}>
        <div className="flex items-center gap-[10px]">
          <LoaderIcon className="w-[18px] h-[18px] animate-spin" />
          Loading testing insights…
        </div>
      </div>
    );
  }

  return (
    <GenerateTestsWorkbench
      key={workbenchKey}
      restoreSessionId={restoreSessionId}
      onStartNewSession={() => setWorkbenchKey(key => key + 1)}
      initialIntent={buildInitialIntent(handoffState, quickActions)}
      featureOptions={featureOptions}
    />
  );
}

interface GenerateTestsWorkbenchProps {
  restoreSessionId: string | null;
  onStartNewSession: () => void;
  initialIntent?: Partial<IntentInput>;
  featureOptions: FeatureModule[];
}

function GenerateTestsWorkbench({
  restoreSessionId,
  onStartNewSession,
  initialIntent,
  featureOptions,
}: GenerateTestsWorkbenchProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const syncSessionToUrl = useCallback((id: string) => {
    // In mock mode (?mock=1) keep the flag in the URL so every step stays mocked; the session id isn't needed.
    if (isMockMode()) return;
    setSearchParams({ session: id }, { replace: true });
  }, [setSearchParams]);

  const wb = useWorkbench(restoreSessionId ? undefined : initialIntent, {
    sessionId: restoreSessionId ?? undefined,
    onSessionId: syncSessionToUrl,
  });
  const { status, error, session, currentStep, pending } = wb;
  const runEvidence = evidenceWithScreenshotFallback(wb.runEvidence, session?.run);

  // Create-PR state: opens the PR in a new tab on success and marks the workflow complete.
  const [creatingPr, setCreatingPr] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const handleCreatePr = useCallback(async (sessionId: string) => {
    if (creatingPr) return;
    setCreatingPr(true);
    toast('Opening pull request…', 'loading');
    try {
      const { url } = await createSessionPullRequest(sessionId);
      setPrUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast('Pull request created', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create pull request', 'success');
    } finally {
      setCreatingPr(false);
    }
  }, [creatingPr, toast]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen grid place-items-center text-[#98a1b3]" style={shellStyle}>
        {status === 'error'
          ? (
            <div className="flex flex-col items-center gap-[12px] max-w-[420px] text-center px-[20px]">
              <WarningTriangleIcon className="w-[28px] h-[28px] text-[#fb7185]" />
              <div>{error ?? 'Failed to load workbench.'}</div>
              {restoreSessionId && (
                <Button variant="outline" onClick={() => { navigate('/tests', { replace: true }); onStartNewSession(); }}>
                  Start new session
                </Button>
              )}
            </div>
          )
          : <div className="flex items-center gap-[10px]"><LoaderIcon className="w-[18px] h-[18px] animate-spin" /> Loading workbench…</div>}
      </div>
    );
  }

  const activeTestType = primaryTestType(session.intent.testTypes);

  return (
    <div className="min-h-screen" style={shellStyle}>
      <TopBar
        repo={session.repo.name}
        branch={session.repo.branch}
        contentClassName="mx-auto max-w-[1118px]"
        user={user}
        onLogout={() => void logout()}
        actions={
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeftIcon className="w-[15px] h-[15px] mr-[6px]" />
            Back to Dashboard
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-[1118px]">
        <WorkflowSidebar currentStep={currentStep} applied={prUrl !== null} onSelect={wb.setStep} />

        <div className="w-full max-w-[900px] p-[26px_28px_70px] min-w-0">
          {error && (
            <div
              role="alert"
              className="mb-[18px] flex items-start gap-[12px] p-[14px_16px] rounded-[12px] border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.08)] text-[#fecdd3]"
            >
              <WarningTriangleIcon className="w-[18px] h-[18px] flex-shrink-0 text-[#fb7185] mt-[1px]" />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-[#fb7185] mb-[4px]">Workbench step failed</div>
                <div className="text-[13px] leading-[1.5] text-[#fecdd3] break-words">{error}</div>
              </div>
              <Button variant="ghost" className="text-[12px] shrink-0" onClick={wb.clearError}>
                Dismiss
              </Button>
            </div>
          )}
          {currentStep === 0 && (
            <IntentStep
              intent={session.intent}
              featureOptions={featureOptions}
              analyzing={pending === 'analyze'}
              analyzeProgress={wb.analyzeProgress}
              onUpdateIntent={wb.updateIntent}
              onAnalyze={wb.analyze}
            />
          )}
          {currentStep === 1 && session.isolation && (
            <IsolationStep
              isolation={session.isolation}
              generating={pending === 'plan'}
              planProgress={wb.planProgress}
              onBack={() => wb.setStep(0)}
              onGeneratePlan={wb.generatePlan}
            />
          )}
          {(currentStep === 2 && session.plan) && (
            <PlanStep
              plan={session.plan}
              generating={pending === 'generate'}
              generateProgress={wb.generateProgress}
              onBack={() => wb.setStep(1)}
              onApprove={wb.approvePlan}
              onEditSubmit={() => toast('Plan edit requested', 'success')}
            />
          )}
          {currentStep === 3 && session.generation && (
            <GenerateStep
              generation={session.generation}
              genStep={wb.genStep}
              genComplete={wb.genComplete}
              onBack={() => wb.setStep(2)}
              onRunTests={wb.runTests}
            />
          )}
          {currentStep === 4 && (
            <RunStep
              run={session.run ?? null}
              activeTestType={activeTestType}
              ranTests={wb.ranTests}
              running={wb.running}
              progress={wb.runProgress}
              evidence={runEvidence}
              onBack={() => wb.setStep(3)}
              onRunWithUrl={manualBaseUrl => wb.runTests({ manualBaseUrl })}
              onReview={() => wb.setStep(5)}
            />
          )}
          {currentStep === 5 && session.review && (
            <ReviewStep
              review={session.review}
              run={session.run ?? null}
              changes={session.generation?.changes ?? []}
              activeTestType={activeTestType}
              prUrl={prUrl}
              creatingPr={creatingPr}
              progress={wb.runProgress}
              evidence={runEvidence}
              onBack={() => wb.setStep(4)}
              onCreatePR={() => void handleCreatePr(session.id)}
              onExport={() => { exportTestPlan(session); toast('Report downloaded', 'success'); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
