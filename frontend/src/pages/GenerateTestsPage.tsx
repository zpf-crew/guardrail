import { useNavigate, useLocation } from 'react-router-dom';
import type { IntentInput, QuickAction } from '@/types/testlens';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ArrowLeftIcon, WarningTriangleIcon, LoaderIcon } from '@/components/icons';
import { mockQuickActions } from '@/data/generateTestsMockData';
import { useWorkbench } from '@/pages/generate-tests/use-workbench';
import { WorkflowSidebar } from '@/pages/generate-tests/workflow-sidebar';
import { exportTestPlan } from '@/pages/generate-tests/export-test-plan';
import { IntentStep } from '@/pages/generate-tests/steps/intent-step';
import { IsolationStep } from '@/pages/generate-tests/steps/isolation-step';
import { PlanStep } from '@/pages/generate-tests/steps/plan-step';
import { GenerateStep } from '@/pages/generate-tests/steps/generate-step';
import { RunStep } from '@/pages/generate-tests/steps/run-step';
import { ReviewStep } from '@/pages/generate-tests/steps/review-step';

/** Insight handoff from the Dashboard (navigate('/tests', { state })). */
interface HandoffState {
  insightId?: string;
  action?: string;
}

function buildInitialIntent(state: HandoffState | null): Partial<IntentInput> | undefined {
  if (!state) return undefined;
  const qa = state.insightId ? mockQuickActions.find(q => q.sourceInsightId === state.insightId) : undefined;
  return {
    prompt: qa?.label ?? state.action ?? '',
    ...(qa ? { feature: qa.feature, testTypes: qa.testTypes } : {}),
  };
}

const shellStyle = { fontFamily: 'var(--sans)' } as const;

export function GenerateTestsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const initialIntent = buildInitialIntent(location.state as HandoffState | null);
  const wb = useWorkbench(initialIntent);
  const { status, error, session, currentStep, pending } = wb;

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen grid place-items-center text-[#98a1b3]" style={shellStyle}>
        {status === 'error'
          ? <div className="flex flex-col items-center gap-[12px]"><WarningTriangleIcon className="w-[28px] h-[28px] text-[#fb7185]" /><div>{error ?? 'Failed to load workbench.'}</div></div>
          : <div className="flex items-center gap-[10px]"><LoaderIcon className="w-[18px] h-[18px] animate-spin" /> Loading workbench…</div>}
      </div>
    );
  }

  const applyQuickAction = (qa: QuickAction) => {
    wb.updateIntent({ prompt: qa.label, feature: qa.feature, testTypes: qa.testTypes });
    toast('Prompt filled from insight', 'success');
  };

  return (
    <div className="min-h-screen" style={shellStyle}>
      <TopBar
        repo={session.repo.name}
        branch={session.repo.branch}
        contentClassName="mx-auto max-w-[1118px]"
        actions={
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeftIcon className="w-[15px] h-[15px] mr-[6px]" />
            Back to Dashboard
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-[1118px]">
        <WorkflowSidebar currentStep={currentStep} applied={wb.applied} onSelect={wb.setStep} />

        <div className="w-full max-w-[900px] p-[26px_28px_70px] min-w-0">
          {currentStep === 0 && (
            <IntentStep
              intent={session.intent}
              quickActions={mockQuickActions}
              analyzing={pending === 'analyze'}
              onUpdateIntent={wb.updateIntent}
              onAnalyze={wb.analyze}
              onApplyQuickAction={applyQuickAction}
            />
          )}
          {currentStep === 1 && session.isolation && (
            <IsolationStep
              isolation={session.isolation}
              generating={pending === 'plan'}
              onBack={() => wb.setStep(0)}
              onGeneratePlan={wb.generatePlan}
            />
          )}
          {currentStep === 2 && session.plan && (
            <PlanStep
              plan={session.plan}
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
              ranTests={wb.ranTests}
              running={wb.running}
              onBack={() => wb.setStep(3)}
              onReview={() => wb.setStep(5)}
              onAttentionAction={a => toast(a === 'fix' ? 'Asked agent to fix the test' : a === 'accept' ? 'Test accepted as known issue' : 'Generated test reverted', 'success')}
            />
          )}
          {currentStep === 5 && session.review && (
            <ReviewStep
              review={session.review}
              changes={session.generation?.changes ?? []}
              applied={wb.applied}
              onBack={() => wb.setStep(4)}
              onApply={() => { wb.apply(); toast('Changes applied to working tree', 'success'); }}
              onCreatePR={() => toast('PR created', 'success')}
              onExport={() => { exportTestPlan(session); toast('Test plan downloaded', 'success'); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
