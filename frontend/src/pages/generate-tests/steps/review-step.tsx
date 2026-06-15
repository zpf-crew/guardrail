import * as React from 'react';
import type { ReviewSummary, GeneratedChange, DiffLine, Evidence, TestType, TestRunResult } from '@/types/testlens';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeDiff } from '@/components/ui/code-diff';
import { MicIcon, FileCodeIcon, CheckIcon } from '@/components/icons';
import { StepHeader, BlockHeader } from '../shared';
import { EvidencePanel } from '../evidence-panel';
import { showsUnitRunSuite } from '../workbench-presentation';
import { buildReviewIssues, type ReviewIssue } from '../review-issues';
import type { RunProgressEvent } from '../use-workbench';

const ISSUE_BADGE: Record<ReviewIssue['kind'], 'fail' | 'flaky' | 'gray'> = {
  failed: 'fail',
  flaky: 'flaky',
  skipped: 'gray',
};

interface ReviewStepProps {
  review: ReviewSummary;
  run: TestRunResult | null;
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

export function ReviewStep({ review, run, changes, activeTestType, applied, progress, evidence, onBack, onApply, onCreatePR, onExport }: ReviewStepProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Every non-passing test (failed/flaky/skipped), enriched with per-test cause/fix where available.
  const issues = React.useMemo(() => buildReviewIssues(run, review.failures), [run, review.failures]);
  // Only a clean run (no issues) earns the green "Apply changes" recommendation; otherwise advise review.
  const hasIssues = issues.length > 0;

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

  return (
    <div>
      <StepHeader
        eyebrow="Step 6 — Review & Apply"
        title="Review the full change set"
        description="You're in control. Apply changes to your working tree or open a PR — Guardrail never commits without your action."
      />

      <div className={`flex items-start gap-[11px] p-[14px_16px] border rounded-[12px] mb-[18px] text-[13px] leading-[1.5] ${
        hasIssues
          ? 'bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)] text-[#f3d9a0]'
          : 'bg-[rgba(61,220,151,0.08)] border-[rgba(61,220,151,0.2)] text-[#b6f0d4]'
      }`}>
        <MicIcon className={`w-[18px] h-[18px] flex-shrink-0 mt-[1px] ${hasIssues ? 'text-[#fbbf24]' : 'text-[#3ddc97]'}`} />
        <div>
          <b className={hasIssues ? 'text-[#fbe3b0]' : 'text-[#d6fae8]'}>
            {hasIssues ? 'Review before applying' : 'Recommended: Apply changes'}
          </b> — {review.recommendation}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-[12px] mb-[20px]">
        {tiles.map(t => (
          <div key={t.label} className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[15px] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: t.color }} />
            <div className="text-[26px] font-bold tracking-[-0.8px] leading-[1] text-white">{t.value}</div>
            <div className="text-[11.5px] text-[#98a1b3] mt-[7px]">{t.label}</div>
          </div>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="mb-[18px]">
          <BlockHeader label="Issues to resolve" count={issues.length} />
          <div className="flex flex-col gap-[8px]">
            {issues.map((issue, i) => (
              <div key={`${issue.file}-${i}`} className={`bg-[#0d0f16] border rounded-[10px] p-[12px_14px] ${issue.kind === 'skipped' ? 'border-[rgba(255,255,255,0.08)]' : 'border-[rgba(251,113,133,0.18)]'}`}>
                <div className="flex items-center gap-[9px] mb-[7px] flex-wrap">
                  <Badge variant={ISSUE_BADGE[issue.kind]}>{issue.kind}</Badge>
                  <span className="text-[13px] font-semibold text-[#e8ebf2]">{issue.title}</span>
                  <span className="text-[10.5px] text-[#6b7488] border border-[rgba(255,255,255,0.08)] rounded-[5px] px-[6px] py-[1px]">{issue.type}</span>
                  <span className="ml-auto font-mono text-[11px] text-[#818cf8] truncate max-w-[280px]">{issue.file}</span>
                </div>
                <div className={`text-[12.5px] leading-[1.5] font-mono ${issue.kind === 'skipped' ? 'text-[#98a1b3]' : 'text-[#f2b8c0]'}`}>{issue.reason}</div>
                {issue.likelyCause && (
                  <div className="text-[12px] text-[#98a1b3] mt-[6px] leading-[1.5]"><span className="text-[#6b7488]">Likely cause:</span> {issue.likelyCause}</div>
                )}
                {issue.suggestedFix && (
                  <div className="text-[12px] text-[#b6f0d4] mt-[3px] leading-[1.5]"><span className="text-[#6b7488]">Suggested fix:</span> {issue.suggestedFix}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
        <EvidencePanel title="Run evidence" progress={progress} evidence={evidence} />
      </div>

      <div className="flex items-center gap-[10px] flex-wrap p-[18px] bg-[#161a24] border border-[rgba(255,255,255,0.12)] rounded-[12px]">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button variant="outline" onClick={onExport}>Export Report</Button>
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
