import * as React from 'react';
import type { IntentInput, QuickAction, TestType, FeatureModule } from '@/types/testlens';
import { Button } from '@/components/ui/button';
import { SearchIcon, CheckIcon, ZapIcon } from '@/components/icons';
import { StepHeader, BlockHeader } from '../shared';
import { primaryTestType } from '../workbench-presentation';
import { WorkbenchProgressPanel } from '../workbench-progress-panel';
import type { AnalyzeProgressEvent } from '../use-workbench';

const TEST_TYPE_OPTIONS: TestType[] = ['Unit', 'Integration', 'UI / Browser', 'Mobile'];

interface IntentStepProps {
  intent: IntentInput;
  quickActions: QuickAction[];
  featureOptions: FeatureModule[];
  analyzing: boolean;
  analyzeProgress: AnalyzeProgressEvent[];
  onUpdateIntent: (patch: Partial<IntentInput>) => void;
  onAnalyze: () => void;
  onApplyQuickAction: (qa: QuickAction) => void;
}

export function IntentStep({
  intent,
  quickActions,
  featureOptions,
  analyzing,
  analyzeProgress,
  onUpdateIntent,
  onAnalyze,
  onApplyQuickAction,
}: IntentStepProps) {
  const selectedType = primaryTestType(intent.testTypes);

  React.useEffect(() => {
    if (intent.testTypes.length === 1) return;
    onUpdateIntent({ testTypes: [primaryTestType(intent.testTypes)] });
  }, [intent.testTypes, onUpdateIntent]);

  const selectType = (type: TestType) => {
    if (selectedType === type) return;
    onUpdateIntent({ testTypes: [type] });
  };

  return (
    <div>
      <StepHeader
        eyebrow="Step 1 — Intent"
        title="What testing do you want to improve?"
        description="Describe a goal in plain language. Guardrail first isolates behavior, classifies risk, and confirms a plan — then writes and runs tests with your approval."
      />

      <div className="bg-[#11141c] border border-[rgba(255,255,255,0.12)] rounded-[14px] p-[18px] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)] mb-[22px] transition-all focus-within:border-[rgba(129,140,248,0.35)] focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.14),0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]">
        <textarea
          className="w-full bg-transparent border-none outline-none resize-none text-[#e8ebf2] text-[15.5px] leading-[1.55] min-h-[54px]"
          placeholder="e.g., Add missing UI tests for the onboarding flow..."
          value={intent.prompt}
          onChange={e => onUpdateIntent({ prompt: e.target.value })}
        />
        <div className="flex items-center gap-[10px] mt-[14px] pt-[14px] border-t border-[rgba(255,255,255,0.07)]">
          <select
            className="appearance-none bg-[#161a24] border border-[rgba(255,255,255,0.07)] text-[#e8ebf2] text-[12.5px] px-[12px] py-[7px] pr-[28px] rounded-[8px] cursor-pointer outline-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2712%27%20height%3D%2712%27%20fill%3D%27none%27%20stroke%3D%27%2398a1b3%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27M3%205l3%203%203-3%27%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_9px_center]"
            value={intent.feature ?? ''}
            onChange={e => onUpdateIntent({ feature: e.target.value })}
          >
            <option value="">All features</option>
            {featureOptions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex-1" />
          <Button variant="primary" size="lg" onClick={onAnalyze} disabled={analyzing}>
            <SearchIcon className="w-[15px] h-[15px] mr-[6px]" />
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      <WorkbenchProgressPanel
        active={analyzing}
        title="Analyzing"
        fallbackMessage="Starting repository scan…"
        events={analyzeProgress}
      />

      <div className="mb-[16px]">
        <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[10px]">Test type</div>
        <div className="flex flex-wrap gap-[8px]">
          {TEST_TYPE_OPTIONS.map(type => {
            const active = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={`inline-flex items-center gap-[7px] text-[12.5px] font-medium px-[13px] py-[7px] rounded-[8px] cursor-pointer transition-all border ${
                  active ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.4)] text-[#c7cdf5]' : 'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'
                }`}
              >
                {active && <CheckIcon strokeWidth={2.5} className="w-[15px] h-[15px]" />}
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-[26px] mt-[26px]">
        <BlockHeader label="Quick actions from dashboard insights" />
        {quickActions.length === 0 ? (
          <p className="text-[13px] text-[#6b7488] leading-[1.5]">
            No dashboard insights yet. Complete onboarding and run a repository scan first.
          </p>
        ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-[12px]">
          {quickActions.map(action => (
            <div
              key={action.id}
              className="flex gap-[12px] p-[14px] rounded-[12px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] cursor-pointer transition-all hover:border-[rgba(129,140,248,0.35)] hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              onClick={() => onApplyQuickAction(action)}
            >
              <div className="w-[34px] h-[34px] rounded-[9px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.14)] text-[#818cf8]">
                <ZapIcon className="w-[17px] h-[17px]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#e8ebf2] leading-[1.35] mb-[4px]">{action.label}</div>
                <div className="text-[11.5px] text-[#6b7488]">{action.feature} · {action.severity} · {primaryTestType(action.testTypes)}</div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
