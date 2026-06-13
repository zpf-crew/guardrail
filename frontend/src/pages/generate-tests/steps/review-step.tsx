import * as React from 'react';
import type { ReviewSummary, RiskRow, GeneratedChange, DiffLine, Evidence, TestType } from '@/types/testlens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeDiff } from '@/components/ui/code-diff';
import { MicIcon, FileCodeIcon, CheckIcon } from '@/components/icons';
import { StepHeader, BlockHeader } from '../shared';
import { EvidencePanel } from '../evidence-panel';
import { showsUnitRunSuite } from '../workbench-presentation';
import type { RunProgressEvent } from '../use-workbench';

const RISK_VALUE_STYLE: Record<string, { width: string; color: string; badge: 'pass' | 'flaky' | 'fail' }> = {
  high: { width: '85%', color: '#fb7185', badge: 'fail' },
  medium: { width: '60%', color: '#fbbf24', badge: 'flaky' },
  low: { width: '30%', color: '#3ddc97', badge: 'pass' },
};

interface ReviewStepProps {
  review: ReviewSummary;
  changes: GeneratedChange[];
  activeTestType: TestType;
  applied: boolean;
  progress: RunProgressEvent[];
  evidence: Evidence[];
  onBack: () => void;
  onApply: () => void;
  onCreatePR: () => void;
  onExport: () => void;
}

export function ReviewStep({ review, changes, activeTestType, applied, progress, evidence, onBack, onApply, onCreatePR, onExport }: ReviewStepProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const scopedChanges = React.useMemo(
    () => changes.filter(change => change.testType === activeTestType),
    [activeTestType, changes],
  );

  const scopedFilesChanged = React.useMemo(
    () => review.filesChanged.filter(file => scopedChanges.some(change => change.file === file.path)),
    [review.filesChanged, scopedChanges],
  );

  // Combine every generated change's diff by target file (a file may have several).
  const diffByFile = React.useMemo(() => {
    const map: Record<string, DiffLine[]> = {};
    for (const c of scopedChanges) {
      if (!map[c.file]) map[c.file] = [];
      if (map[c.file].length) map[c.file].push({ kind: 'meta', text: '' });
      map[c.file].push(...c.diff);
    }
    return map;
  }, [scopedChanges]);

  const testsAdded = scopedChanges.filter(change => change.action === 'Add').length;
  const testsUpdated = scopedChanges.filter(change => change.action === 'Update').length;
  const testsDeleted = scopedChanges.filter(change => change.action === 'Delete').length;

  const toggle = (path: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(path) ? next.delete(path) : next.add(path);
    return next;
  });

  const tiles: { label: string; value: string; color: string }[] = [
    { label: `${activeTestType} tests added`, value: String(testsAdded), color: '#3ddc97' },
    { label: `${activeTestType} tests updated`, value: String(testsUpdated), color: '#60a5fa' },
    { label: `${activeTestType} tests deleted`, value: String(testsDeleted), color: '#fb7185' },
    { label: `${activeTestType} tests passing`, value: review.testsPassing, color: '#3ddc97' },
    ...(showsUnitRunSuite(activeTestType)
      ? [
        { label: 'Line coverage', value: `+${review.coverage.lineDelta}%`, color: '#3ddc97' },
        { label: 'Branch coverage', value: `+${review.coverage.branchDelta}%`, color: '#fbbf24' },
      ]
      : []),
    { label: 'Flaky tracked', value: String(review.flakyTracked), color: '#fb7185' },
    { label: 'Files changed', value: String(scopedFilesChanged.length), color: '#818cf8' },
  ];

  const riskStyle = (r: RiskRow) => RISK_VALUE_STYLE[r.value] ?? RISK_VALUE_STYLE.low;

  return (
    <div>
      <StepHeader
        eyebrow="Step 6 — Review & Apply"
        title="Review the full change set"
        description="You're in control. Apply changes to your working tree or open a PR — Guardrail never commits without your action."
      />

      <div className="flex items-start gap-[11px] p-[14px_16px] bg-[rgba(61,220,151,0.08)] border border-[rgba(61,220,151,0.2)] rounded-[12px] mb-[18px] text-[13px] text-[#b6f0d4] leading-[1.5]">
        <MicIcon className="w-[18px] h-[18px] flex-shrink-0 text-[#3ddc97] mt-[1px]" />
        <div><b className="text-[#d6fae8]">Recommended: Apply changes</b> — {review.recommendation}</div>
      </div>

      <EvidencePanel title="Evidence from run" progress={progress} evidence={evidence} />

      <div className="grid grid-cols-4 gap-[12px] mb-[20px]">
        {tiles.map(t => (
          <div key={t.label} className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[15px] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: t.color }} />
            <div className="text-[26px] font-bold tracking-[-0.8px] leading-[1] text-white">{t.value}</div>
            <div className="text-[11.5px] text-[#98a1b3] mt-[7px]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-[18px]">
        <BlockHeader label={`${activeTestType} files changed`} count={scopedFilesChanged.length} />
        <div className="flex flex-col gap-[6px]">
          {scopedFilesChanged.map(f => {
            const diff = diffByFile[f.path];
            const open = expanded.has(f.path);
            return (
              <div key={f.path} className="bg-[#0d0f16] rounded-[8px] overflow-hidden border border-[rgba(255,255,255,0.05)]">
                <div
                  className={`flex items-center gap-[10px] px-[12px] py-[8px] ${diff ? 'cursor-pointer hover:bg-[rgba(255,255,255,0.02)]' : ''}`}
                  onClick={() => diff && toggle(f.path)}
                >
                  <FileCodeIcon className="w-[12px] h-[12px] text-[#818cf8] flex-shrink-0" />
                  <span className="text-[12px] font-mono text-[#e8ebf2] flex-1">{f.path}</span>
                  <span className="text-[11px] text-[#6b7488] font-mono">{f.diffStat}</span>
                  {diff
                    ? <span className={`text-[#6b7488] text-[11px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
                    : <span className="text-[10px] text-[#6b7488] italic">no preview</span>}
                </div>
                {open && diff && (
                  <div className="border-t border-[rgba(255,255,255,0.07)] bg-[#07090d] p-[12px_14px] overflow-x-auto">
                    <CodeDiff diff={diff} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-[18px]">
        <BlockHeader label="Remaining risk" />
        <div className="flex flex-col gap-[6px]">
          {review.remainingRisk.map(r => {
            const s = riskStyle(r);
            return (
              <div key={r.label} className="flex items-center gap-[12px] bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                <div className="flex-1">
                  <div className="text-[12px] text-[#e8ebf2]">{r.label}</div>
                  <div className="w-full h-[3px] bg-[rgba(255,255,255,0.05)] rounded-full mt-[4px] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: s.width, backgroundColor: s.color }} />
                  </div>
                </div>
                <Badge variant={s.badge}>{r.value}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-[10px] flex-wrap p-[18px] bg-[#161a24] border border-[rgba(255,255,255,0.12)] rounded-[12px]">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button variant="outline" onClick={onExport}>Export Test Plan</Button>
        <Button variant="outline" onClick={onCreatePR}>Create PR</Button>
        <div className="flex-1" />
        {applied ? (
          <Button variant="primary" size="lg" disabled>
            <CheckIcon strokeWidth={2.5} className="w-[15px] h-[15px] mr-[6px]" />
            Changes Applied
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={onApply}>Apply Changes</Button>
        )}
      </div>
    </div>
  );
}
