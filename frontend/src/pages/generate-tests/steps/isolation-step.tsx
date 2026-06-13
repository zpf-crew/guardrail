import type { IsolationResult } from '@/types/testlens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, ChevronRightIcon } from '@/components/icons';
import { StepHeader, BlockHeader, FileIcon } from '../shared';
import { RISK_BADGE, CLASS_STATUS_BADGE, CLASS_BORDER_COLOR } from '../workbench-presentation';

import { WorkbenchProgressPanel } from '../workbench-progress-panel';
import type { WorkbenchProgressEvent } from '../use-workbench';

interface IsolationStepProps {
  isolation: IsolationResult;
  generating: boolean;
  planProgress: WorkbenchProgressEvent[];
  onBack: () => void;
  onGeneratePlan: () => void;
}

export function IsolationStep({ isolation, generating, planProgress, onBack, onGeneratePlan }: IsolationStepProps) {
  const codeFiles = [...isolation.sourceFiles, ...isolation.existingTestFiles];
  const docFiles = [...isolation.specDocs.map(f => f.path), ...isolation.qcCases.map(q => `${q.id} · ${q.scenario}`)];
  const { failed, suspicious, missing } = isolation.currentStatus;
  const highRisk = isolation.classifications.filter(c => c.risk === 'High' || c.risk === 'Critical').length;

  return (
    <div>
      <StepHeader
        eyebrow="Step 2 — Isolation & Classification"
        title="Here's the behavior I've isolated"
        description={`Guardrail scoped your request to the ${isolation.target.feature} module and classified what should be tested by status and risk.`}
      />

      <div className="grid grid-cols-2 gap-[14px] mb-[22px]">
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
          <BlockHeader label="Source & existing tests" />
          {codeFiles.map(f => (
            <div key={f.path} className="flex items-center gap-[10px] py-[9px] border-b border-[rgba(255,255,255,0.07)] text-[12.5px] last:border-b-0">
              <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.13)] text-[#818cf8]"><FileIcon type="code" /></div>
              <span className="font-mono text-[#e8ebf2] text-[12px]">{f.path}</span>
              {f.meta && <span className="ml-auto text-[11px] text-[#6b7488]">{f.meta}</span>}
            </div>
          ))}
        </div>
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
          <BlockHeader label="Specs & QC test cases" />
          {docFiles.map(f => (
            <div key={f} className="flex items-center gap-[10px] py-[9px] border-b border-[rgba(255,255,255,0.07)] text-[12.5px] last:border-b-0">
              <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(251,191,36,0.13)] text-[#fbbf24]"><FileIcon type="doc" /></div>
              <span className="text-[#e8ebf2] text-[12px]">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[12px] mb-[22px]">
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
          <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[6px]">Current coverage</div>
          <div className="flex items-baseline gap-[8px] mt-[6px]">
            <span className="font-mono text-[24px] font-bold text-[#fbbf24]">{isolation.currentCoverage.line}%</span>
            <span className="text-[12px] text-[#6b7488]">line · {isolation.currentCoverage.branch}% branch</span>
          </div>
        </div>
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
          <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[6px]">Current test status</div>
          <div className="flex gap-[6px] mt-[8px] flex-wrap">
            <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] text-[#fb7185] bg-[rgba(251,113,133,0.14)]">{failed} failed</span>
            <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] text-[#c084fc] bg-[rgba(192,132,252,0.15)]">{suspicious} suspicious</span>
            <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] text-[#60a5fa] bg-[rgba(96,165,250,0.14)]">{missing} missing</span>
          </div>
        </div>
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
          <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[6px]">Detected user journeys</div>
          <div className="text-[12.5px] text-[#98a1b3] mt-[7px] leading-[1.5]">{isolation.userJourneys.join(' · ')}</div>
        </div>
      </div>

      <div className="mb-[22px]">
        <BlockHeader label="Behavior classification" count={isolation.classifications.length} />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[12px]">
          {isolation.classifications.map(c => (
            <div key={c.behavior} className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] transition-all hover:border-[rgba(255,255,255,0.12)] hover:translate-y-[-2px] relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: CLASS_BORDER_COLOR[c.status] }} />
              <div className="flex flex-wrap gap-[6px] mb-[9px] items-center">
                <Badge variant={CLASS_STATUS_BADGE[c.status]} dot>{c.status}</Badge>
                <span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{c.suggestedTypes.join(', ')}</span>
                <Badge variant={RISK_BADGE[c.risk]}>{c.risk}</Badge>
              </div>
              <div className="text-[13.5px] font-semibold text-[#e8ebf2] mb-[8px]">{c.behavior}</div>
              <div className="text-[12px] text-[#98a1b3] leading-[1.45]">{c.explanation}</div>
            </div>
          ))}
        </div>
      </div>

      <WorkbenchProgressPanel
        active={generating}
        title="Generating plan"
        fallbackMessage="Building test plan from isolation evidence…"
        events={planProgress}
      />

      <div className="flex items-center gap-[10px] flex-wrap p-[16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px]">
        <Button variant="ghost" onClick={onBack}><ArrowLeftIcon className="w-[15px] h-[15px] mr-[6px]" />Back</Button>
        <div className="flex-1" />
        <span className="text-[12px] text-[#6b7488]">{isolation.classifications.length} areas need attention · {highRisk} high risk</span>
        <Button variant="primary" size="lg" onClick={onGeneratePlan} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Test Plan'}
          <ChevronRightIcon className="w-[15px] h-[15px] ml-[6px]" />
        </Button>
      </div>
    </div>
  );
}
