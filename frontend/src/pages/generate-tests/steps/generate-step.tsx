import * as React from 'react';
import type { GenerationResult, GeneratedChange } from '@/types/testlens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeDiff } from '@/components/ui/code-diff';
import { CheckIcon, ChevronRightIcon, ChangeTypeIcon, TrashIcon, LoaderIcon } from '@/components/icons';
import { StepHeader, BlockHeader } from '../shared';
import { RISK_BADGE, CHANGE_ACTION_STYLE } from '../workbench-presentation';

const FILTERS = ['All', 'Add', 'Update', 'Delete', 'Unit', 'UI / Browser', 'Mobile'] as const;

function matchesFilter(change: GeneratedChange, filter: string): boolean {
  if (filter === 'All') return true;
  if (filter === 'Add' || filter === 'Update' || filter === 'Delete') return change.action === filter;
  return change.testType === filter;
}

function lineSummary(change: GeneratedChange): string {
  const adds = change.diff.filter(d => d.kind === 'add').length;
  const dels = change.diff.filter(d => d.kind === 'del').length;
  if (change.action === 'Add') return `+${adds} lines`;
  if (change.action === 'Delete') return `-${dels} lines`;
  return `~${adds + dels} lines`;
}

interface GenerateStepProps {
  generation: GenerationResult;
  genStep: number;
  genComplete: boolean;
  onBack: () => void;
  onRunTests: () => void;
}

export function GenerateStep({ generation, genStep, genComplete, onBack, onRunTests }: GenerateStepProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState('All');
  const { timeline, changes, beforeAfter } = generation;

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Reveal changes in step with the timeline animation.
  const revealCount = genComplete ? changes.length : Math.floor((genStep / Math.max(timeline.length, 1)) * changes.length);
  const revealed = changes.slice(0, revealCount);
  const filtered = revealed.filter(c => matchesFilter(c, filter));
  const countFor = (f: string) => revealed.filter(c => matchesFilter(c, f)).length;

  return (
    <div>
      <StepHeader
        eyebrow="Step 4 — Generate Changes"
        title={genComplete ? 'Tests written & ready to run' : 'Writing & updating tests…'}
        description="Agent activity is shown live. Every change below is a proposal — nothing is applied to your repo yet."
      />

      <div className="grid grid-cols-[280px_1fr] gap-[14px] items-start mb-[22px]">
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px] sticky top-[74px]">
          <BlockHeader label="Agent activity" />
          <div className="flex flex-col">
            {timeline.map((t, i) => {
              const state = i < genStep ? 'done' : i === genStep ? 'running' : 'pending';
              return (
                <div key={t.label} className="flex gap-[13px] pb-[14px] relative">
                  {i < timeline.length - 1 && (
                    <div className={`absolute left-[12px] top-[26px] bottom-0 w-[1.5px] ${state === 'done' ? 'bg-[rgba(61,220,151,0.4)]' : 'bg-[rgba(255,255,255,0.12)]'}`} />
                  )}
                  <div className={`w-[25px] h-[25px] rounded-full flex-shrink-0 grid place-items-center z-[1] ${
                    state === 'done' ? 'bg-[rgba(61,220,151,0.13)] border border-[rgba(61,220,151,0.45)] text-[#3ddc97]' :
                    state === 'running' ? 'bg-[rgba(129,140,248,0.14)] border border-[rgba(129,140,248,0.5)] text-[#818cf8]' :
                    'bg-[#0d0f16] border border-[rgba(255,255,255,0.12)] text-[#6b7488]'
                  }`}>
                    {state === 'done' ? <CheckIcon strokeWidth={2.4} className="w-[13px] h-[13px]" />
                      : state === 'running' ? <LoaderIcon className="w-[13px] h-[13px] animate-spin" />
                      : <span className="w-[6px] h-[6px] rounded-full bg-[#6b7488]" />}
                  </div>
                  <div className={`text-[13px] pt-[3px] ${state === 'pending' ? 'text-[#6b7488]' : 'text-[#e8ebf2]'}`}>{t.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-[8px] flex-wrap mb-[14px]">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[12px] font-medium px-[12px] py-[6px] rounded-[7px] cursor-pointer transition-all border ${filter === f ? 'bg-[#1b2030] text-white border-[rgba(255,255,255,0.12)]' : 'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'}`}
              >
                {f}
                {f !== 'All' && <span className="font-mono text-[10.5px] opacity-70 ml-[4px]">{countFor(f)}</span>}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-[11px] mb-[18px]">
            {filtered.length === 0 && !genComplete && (
              <div className="flex items-center gap-[9px] text-[12.5px] text-[#98a1b3] p-[16px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px]">
                <LoaderIcon className="w-[15px] h-[15px] animate-spin text-[#818cf8]" /> Writing tests…
              </div>
            )}
            {filtered.map(change => {
              const style = CHANGE_ACTION_STYLE[change.action];
              return (
                <div key={change.id} className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] overflow-hidden transition-all hover:border-[rgba(255,255,255,0.12)]">
                  <div className="flex items-start gap-[13px] p-[14px_16px] cursor-pointer" onClick={() => toggle(change.id)}>
                    <div className="w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center mt-[1px]" style={{ background: style.bg, color: style.color }}>
                      <ChangeTypeIcon changeType={change.action.toLowerCase() as 'add' | 'update' | 'delete'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[7px] flex-wrap mb-[6px]">
                        <span className="text-[10px] font-bold uppercase tracking-[0.5px] px-[7px] py-[2px] rounded-[5px]" style={{ background: style.bg, color: style.color }}>{change.action}</span>
                        <span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{change.testType}</span>
                        <Badge variant="accent">{change.feature}</Badge>
                        <Badge variant={RISK_BADGE[change.risk]}>{change.risk}</Badge>
                      </div>
                      <div className="text-[14px] font-semibold text-[#e8ebf2] leading-[1.4] mb-[5px] tracking-[-0.1px]">{change.title}</div>
                      <div className="font-mono text-[11.5px] text-[#818cf8] mb-[7px]">{change.file}</div>
                      <div className="text-[12.5px] text-[#98a1b3] leading-[1.45]">{change.reason}</div>
                    </div>
                    <div className="flex flex-col items-end gap-[7px] flex-shrink-0">
                      <span className="text-[11px] font-semibold" style={{ color: style.color }}>{lineSummary(change)}</span>
                      <span className={`text-[#6b7488] text-[11px] transition-transform duration-200 ${expanded.has(change.id) ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </div>
                  {expanded.has(change.id) && (
                    <div className="border-t border-[rgba(255,255,255,0.07)] bg-[#07090d] p-[13px_16px] overflow-x-auto">
                      <CodeDiff diff={change.diff} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {genComplete && (
        <div className="mb-[22px]">
          <BlockHeader label="Before / After comparison" />
          <div className="grid grid-cols-[1fr_auto_1fr] gap-[16px] items-stretch">
            <div className="bg-[#0d0f16] border border-[rgba(251,113,133,0.2)] rounded-[12px] p-[15px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#fb7185] mb-[11px] flex items-center gap-[7px]"><TrashIcon className="w-[14px] h-[14px]" />Before</div>
              <ul className="m-0 p-0 list-none flex flex-col gap-[9px]">
                {beforeAfter.before.map(b => (
                  <li key={b} className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]"><CheckIcon className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#fb7185]" />{b}</li>
                ))}
              </ul>
            </div>
            <div className="grid place-items-center text-[#6b7488]"><ChevronRightIcon className="w-[22px] h-[22px]" /></div>
            <div className="bg-[#0d0f16] border border-[rgba(61,220,151,0.25)] rounded-[12px] p-[15px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#3ddc97] mb-[11px] flex items-center gap-[7px]"><CheckIcon className="w-[14px] h-[14px]" />After</div>
              <ul className="m-0 p-0 list-none flex flex-col gap-[9px]">
                {beforeAfter.after.map(a => (
                  <li key={a} className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]"><CheckIcon className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#3ddc97]" />{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-[10px]">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        {genComplete
          ? <Button variant="primary" size="lg" onClick={onRunTests}>Run Tests</Button>
          : <Button variant="primary" size="lg" disabled><LoaderIcon className="w-[15px] h-[15px] mr-[6px] animate-spin" />Generating…</Button>}
      </div>
    </div>
  );
}
