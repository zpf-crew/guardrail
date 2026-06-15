import * as React from 'react';
import type { IntentInput, TestType, FeatureModule } from '@/types/testlens';
import { Button } from '@/components/ui/button';
import { SearchIcon, CheckIcon } from '@/components/icons';
import { StepHeader } from '../shared';
import { primaryTestType } from '../workbench-presentation';
import { WorkbenchProgressPanel } from '../workbench-progress-panel';
import type { AnalyzeProgressEvent } from '../use-workbench';

const DEMO_TEST_TYPE: TestType = 'UI / Browser';
const TEST_TYPE_OPTIONS: { type: TestType; disabled: boolean }[] = [
  { type: 'Unit', disabled: true },
  { type: 'Integration', disabled: true },
  { type: DEMO_TEST_TYPE, disabled: false },
  { type: 'Mobile', disabled: true },
];

interface IntentStepProps {
  intent: IntentInput;
  featureOptions: FeatureModule[];
  analyzing: boolean;
  analyzeProgress: AnalyzeProgressEvent[];
  onUpdateIntent: (patch: Partial<IntentInput>) => void;
  onAnalyze: () => void;
}

export function IntentStep({
  intent,
  featureOptions,
  analyzing,
  analyzeProgress,
  onUpdateIntent,
  onAnalyze,
}: IntentStepProps) {
  const selectedType = primaryTestType(intent.testTypes);

  React.useEffect(() => {
    if (intent.testTypes.length === 1 && selectedType === DEMO_TEST_TYPE) return;
    onUpdateIntent({ testTypes: [DEMO_TEST_TYPE] });
  }, [intent.testTypes, onUpdateIntent, selectedType]);

  const selectType = (type: TestType) => {
    if (type !== DEMO_TEST_TYPE) return;
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
          {TEST_TYPE_OPTIONS.map(({ type, disabled }) => {
            const active = selectedType === type;
            return (
              <span key={type} title={disabled ? 'Coming soon' : undefined}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-disabled={disabled}
                  onClick={() => selectType(type)}
                  className={`inline-flex items-center gap-[7px] text-[12.5px] font-medium px-[13px] py-[7px] rounded-[8px] transition-all border ${
                    active ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.4)] text-[#c7cdf5] cursor-pointer' :
                    disabled ? 'bg-[#11141c] border-[rgba(255,255,255,0.06)] text-[#596174] cursor-not-allowed opacity-70' :
                    'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2] cursor-pointer'
                  }`}
                >
                  {active && <CheckIcon strokeWidth={2.5} className="w-[15px] h-[15px]" />}
                  {type}
                </button>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
