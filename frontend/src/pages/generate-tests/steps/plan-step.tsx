import * as React from 'react';
import type { TestPlan, PlanAction, PlanRiskAssessment, PlanApproval } from '@/types/testlens';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, CheckIcon, PlanActionIcon } from '@/components/icons';
import { StepHeader, BlockHeader, FileIcon } from '../shared';

type RiskLevel = 'low' | 'medium' | 'high';

const ACTION_COLOR: Record<PlanAction['action'], string> = {
  add: '#3ddc97', update: '#60a5fa', delete: '#fb7185', run: '#818cf8',
};
const ACTION_BG: Record<PlanAction['action'], string> = {
  add: 'rgba(61,220,151,0.13)', update: 'rgba(96,165,250,0.13)', delete: 'rgba(251,113,133,0.14)', run: 'rgba(129,140,248,0.14)',
};

/** Flatten the structured risk assessment into labeled rows for display. */
function riskRows(risk: PlanRiskAssessment): { item: string; level: RiskLevel }[] {
  return [
    { item: 'Production code changes', level: risk.productionCodeChanges === 'expected' ? 'high' : 'low' },
    { item: 'Test data changes', level: risk.testDataChanges ? 'medium' : 'low' },
    { item: 'Browser automation required', level: risk.browserAutomationRequired ? 'medium' : 'low' },
    { item: 'Mobile simulator', level: risk.mobileSimulatorRequired === 'required' ? 'medium' : 'low' },
    { item: 'External API mocking', level: risk.externalApiMocking === 'required' ? 'medium' : 'low' },
  ];
}

const LEVEL_CLASS: Record<RiskLevel, string> = {
  low: 'text-[#3ddc97] bg-[rgba(61,220,151,0.13)]',
  medium: 'text-[#fbbf24] bg-[rgba(251,191,36,0.14)]',
  high: 'text-[#fb7185] bg-[rgba(251,113,133,0.14)]',
};

import { WorkbenchProgressPanel } from '../workbench-progress-panel';
import type { WorkbenchProgressEvent } from '../use-workbench';

interface PlanStepProps {
  plan: TestPlan;
  generating: boolean;
  generateProgress: WorkbenchProgressEvent[];
  onBack: () => void;
  onApprove: (approval: PlanApproval) => void;
  onEditSubmit: (text: string) => void;
}

export function PlanStep({ plan, generating, generateProgress, onBack, onApprove, onEditSubmit }: PlanStepProps) {
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState('');

  const submitEdit = () => {
    onEditSubmit(editText.trim());
    setEditing(false);
    setEditText('');
  };

  return (
    <div>
      <StepHeader
        eyebrow="Step 3 — Confirmation & Plan"
        title="Review the plan before I touch any files"
        description="Nothing is written yet. Approve or edit the plan — and answer a few questions so the generated tests match your product spec."
      />

      <div className="grid grid-cols-2 gap-[14px] mb-[14px] items-start">
        <div>
          <BlockHeader label="Proposed actions" />
          <div className="flex flex-col gap-[9px]">
            {plan.proposedActions.map(a => (
              <div key={a.label} className="flex items-center gap-[12px] p-[12px_14px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[11px]">
                <div className="w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center" style={{ background: ACTION_BG[a.action], color: ACTION_COLOR[a.action] }}>
                  <PlanActionIcon action={a.label} />
                </div>
                <span className="text-[13.5px] text-[#e8ebf2] font-medium">{a.label}</span>
                <span className="ml-auto font-mono text-[16px] font-bold" style={{ color: ACTION_COLOR[a.action] }}>{a.count ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <BlockHeader label="Risk assessment" />
          <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
            {riskRows(plan.risk).map(r => (
              <div key={r.item} className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.07)] text-[13px] last:border-b-0">
                <span className="text-[#98a1b3]">{r.item}</span>
                <span className={`font-mono text-[10.5px] font-bold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-[5px] ${LEVEL_CLASS[r.level]}`}>{r.level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-[22px]">
        <BlockHeader label="Files likely to change" count={plan.filesToChange.length} />
        <div className="grid grid-cols-2 gap-x-[14px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[8px_16px]">
          {plan.filesToChange.map(f => (
            <div key={f} className="flex items-center gap-[10px] py-[9px] text-[12.5px]">
              <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.13)] text-[#818cf8]"><FileIcon type="code" /></div>
              <span className="font-mono text-[#e8ebf2] text-[12px] truncate">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[22px]">
        <BlockHeader label="Questions before I write tests" />
        {plan.questions.map(q => (
          <div key={q.id} className="bg-[#11141c] border border-[rgba(192,132,252,0.22)] rounded-[12px] p-[15px] mb-[11px]">
            <div className="flex items-start gap-[10px] mb-[12px]">
              <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(192,132,252,0.15)] text-[#c084fc] font-bold text-[14px]">?</div>
              <div className="text-[13.5px] text-[#e8ebf2] font-medium leading-[1.45] pt-[3px]">{q.question}</div>
            </div>
            <div className="flex flex-wrap gap-[8px]">
              {q.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: q.options.indexOf(opt) }))}
                  className={`text-[12.5px] px-[14px] py-[8px] rounded-[8px] cursor-pointer transition-all border ${
                    answers[q.id] === q.options.indexOf(opt) ? 'bg-[rgba(192,132,252,0.15)] border-[rgba(192,132,252,0.5)] text-[#e8d8fa] font-semibold' : 'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="mb-[14px] bg-[#11141c] border border-[rgba(129,140,248,0.25)] rounded-[12px] p-[15px]">
          <div className="text-[12.5px] text-[#e8ebf2] font-medium mb-[10px]">What would you like to change about this plan?</div>
          <textarea
            autoFocus
            value={editText}
            onChange={e => setEditText(e.target.value)}
            placeholder="e.g., Skip the mobile tests, and add a case for negative discount amounts..."
            className="w-full bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[8px] p-[10px_12px] text-[13px] text-[#e8ebf2] outline-none resize-none min-h-[72px] leading-[1.5] focus:border-[rgba(129,140,248,0.4)]"
          />
          <div className="flex gap-[8px] mt-[10px] justify-end">
            <Button variant="ghost" onClick={() => { setEditing(false); setEditText(''); }}>Cancel edit</Button>
            <Button variant="primary" onClick={submitEdit} disabled={!editText.trim()}>Submit edit</Button>
          </div>
        </div>
      )}

      <WorkbenchProgressPanel
        active={generating}
        title="Generating tests"
        fallbackMessage="Preparing staged test artifacts from approved plan…"
        events={generateProgress}
      />

      <div className="flex items-center gap-[10px] flex-wrap p-[16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px]">
        <Button variant="ghost" onClick={onBack}><ArrowLeftIcon className="w-[15px] h-[15px] mr-[6px]" />Back</Button>
        <Button variant="outline" onClick={() => setEditing(v => !v)}>Edit Plan</Button>
        <div className="flex-1" />
        <Button variant="primary" size="lg" onClick={() => onApprove({ decision: 'approve', answers })} disabled={generating}><CheckIcon className="w-[15px] h-[15px] mr-[6px]" />{generating ? 'Generating...' : 'Approve Plan'}</Button>
      </div>
    </div>
  );
}
