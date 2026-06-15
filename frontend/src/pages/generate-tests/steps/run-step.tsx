import type { ReactNode } from 'react';
import type { Evidence, TestRunResult, RunOutcome, TestType, TestResultRow } from '@/types/testlens';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RunResultIcon, MicIcon, MonitorIcon, SmartphoneIcon, EyeIcon, LoaderIcon } from '@/components/icons';
import { StepHeader, BlockHeader } from '../shared';
import { RUN_OUTCOME_STYLE, showsMobileRunSuite, showsUiRunSuite, showsUnitRunSuite } from '../workbench-presentation';
import { EvidencePanel } from '../evidence-panel';
import type { RunProgressEvent } from '../use-workbench';

const ICON_STATUS: Record<RunOutcome, 'pass' | 'fail' | 'running'> = {
  Passed: 'pass', Failed: 'fail', Flaky: 'fail', Skipped: 'running', 'Needs approval': 'running',
};

const fmt = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

interface RunStepProps {
  run: TestRunResult | null;
  activeTestType: TestType;
  ranTests: number;
  running: boolean;
  progress: RunProgressEvent[];
  evidence: Evidence[];
  onBack: () => void;
  onReview: () => void;
}

export function RunStep({ run, activeTestType, ranTests, running, progress, evidence, onBack, onReview }: RunStepProps) {

  // Real API: results not back yet — show an honest running placeholder.
  if (!run) {
    return (
      <div>
        <StepHeader eyebrow="Step 5 — Run Tests" title="Running tests…" />
        <ProgressBar value={100} />
        <div className="flex items-center gap-[9px] text-[12.5px] text-[#98a1b3] mt-[14px]">
          <LoaderIcon className="w-[15px] h-[15px] animate-spin text-[#818cf8]" /> Executing the generated test suites…
        </div>
        <div className="mt-[18px]">
          <EvidencePanel running progress={progress} evidence={evidence} />
        </div>
        <div className="mt-[18px]"><Button variant="ghost" onClick={onBack}>Back</Button></div>
      </div>
    );
  }

  const total = run.matrix.filter(row => row.type === activeTestType).length;
  const complete = !running;
  const progressPercent = total ? Math.round((ranTests / total) * 100) : 100;
  const matrixRows = run.matrix.filter(row => row.type === activeTestType);
  const revealed = complete ? matrixRows : matrixRows.slice(0, ranTests);

  return (
    <div>
      <StepHeader eyebrow="Step 5 — Run Tests" title={complete ? 'Test run complete' : 'Running tests…'} />

      <div className="mb-[18px]">
        <ProgressBar value={progressPercent} />
        <div className="text-[11px] text-[#6b7488] mt-[6px]">{complete ? `${total} / ${total} tests · complete` : `${ranTests} / ${total} tests`}</div>
      </div>

      <EvidencePanel running={running} progress={progress} evidence={evidenceWithScreenshotFallback(evidence, run)} />

      {complete && (
        <div className="flex flex-col gap-[18px] mb-[18px]">
          {showsUnitRunSuite(activeTestType) && (
            <SuiteHeader icon={<MicIcon className="w-[16px] h-[16px]" />} title="Unit Tests" command={run.unit.command} pass={`${run.unit.passed}/${run.unit.passed + (run.unit.failed ?? 0)} pass`} duration={fmt(run.unit.durationMs)} ok={run.unit.outcome === 'Passed'} />
          )}
          {showsUiRunSuite(activeTestType) && (
            <div>
              <SuiteHeader icon={<MonitorIcon className="w-[16px] h-[16px]" />} title="UI/Browser Tests" command={run.ui.command} pass={`${run.ui.passed} pass`} duration={fmt(run.ui.durationMs)} ok={run.ui.outcome === 'Passed'} />
              {run.ui.visual && (
                <div className="border border-[rgba(255,255,255,0.07)] border-t-0 rounded-[0_0_12px_12px] p-[12px_16px] text-[10.5px] text-[#6b7488] flex items-center gap-[6px]">
                  <span className="text-[#3ddc97]">✓</span> Visual check {run.ui.visual.matchPercent}% match vs baseline
                </div>
              )}
            </div>
          )}
          {showsMobileRunSuite(activeTestType) && (
            <SuiteHeader icon={<SmartphoneIcon className="w-[16px] h-[16px]" />} title="Mobile Tests" command={run.mobile.command} pass={`${run.mobile.passed}/${run.mobile.devices.length} pass`} duration={fmt(run.mobile.durationMs)} ok={run.mobile.outcome === 'Passed'} />
          )}
        </div>
      )}

      {complete && showsUnitRunSuite(activeTestType) && run.coverage.length > 0 && (
        <div className="mb-[18px]">
          <BlockHeader label="Coverage comparison" />
          <div className="grid grid-cols-4 gap-[12px]">
            {run.coverage.map(c => (
              <div key={c.metric} className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[14px]">
                <div className="text-[11.5px] text-[#98a1b3] mb-[9px]">{c.metric}</div>
                <div className="flex items-baseline gap-[8px]">
                  <span className="font-mono text-[15px] text-[#6b7488] line-through">{c.before}%</span>
                  <span className="font-mono text-[24px] font-bold tracking-[-0.5px] text-white">{c.after}%</span>
                  <span className="text-[11px] font-bold text-[#3ddc97] ml-auto">+{c.after - c.before}%</span>
                </div>
                <div className="h-[6px] rounded-full bg-[rgba(255,255,255,0.06)] mt-[11px] overflow-hidden relative">
                  <div className="absolute left-0 top-0 bottom-0 rounded-full bg-[#818cf8]" style={{ width: `${c.after}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-[18px]">
        <BlockHeader label="Test results" count={complete ? total : undefined} />
        <table className="w-full border-collapse text-[12.5px] mt-[4px]">
          <thead>
            <tr>{['Test', 'Type', 'Status', 'Reason', 'Duration', 'Evidence', 'File'].map(h => (
              <th key={h} className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {revealed.map(row => {
              const style = RUN_OUTCOME_STYLE[row.status];
              return (
                <tr key={row.title} className="hover:bg-[rgba(255,255,255,0.018)]">
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] text-[#e8ebf2] font-medium">{row.title}</td>
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)]"><span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{row.type}</span></td>
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)]">
                    <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px]" style={{ background: style.bg, color: style.color }}>
                      <RunResultIcon status={ICON_STATUS[row.status]} />{row.status}
                    </span>
                  </td>
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] text-[#98a1b3] max-w-[280px]">
                    {row.reason
                      ? <span className="text-[11.5px] leading-[1.45] text-[#fb7185] break-words">{row.reason}</span>
                      : <span className="text-[#6b7488]">—</span>}
                  </td>
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] text-[#98a1b3]">{row.duration ?? '—'}</td>
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)]">
                    <MatrixEvidenceCell row={row} />
                  </td>
                  <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] font-mono text-[11px] text-[#6b7488]">{row.file}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!complete && <div className="flex items-center gap-[8px] text-[11.5px] text-[#6b7488] mt-[10px]"><LoaderIcon className="w-[13px] h-[13px] animate-spin text-[#818cf8]" /> running…</div>}
      </div>

      <div className="flex gap-[10px] mt-[18px]">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        {complete
          ? <Button variant="primary" size="lg" onClick={onReview}>Review &amp; Apply</Button>
          : <Button variant="primary" size="lg" disabled><LoaderIcon className="w-[15px] h-[15px] mr-[6px] animate-spin" />Running…</Button>}
      </div>
    </div>
  );
}

function MatrixEvidenceCell({ row }: { row: TestResultRow }) {
  const items = row.evidenceItems?.filter(item => item.href) ?? [];
  if (items.length === 0) {
    if (!row.evidence) return null;
    return <span className="text-[#6b7488] text-[11.5px]">{row.evidence}</span>;
  }

  return (
    <div className="flex flex-wrap gap-x-[10px] gap-y-[4px]">
      {items.map((item, index) => (
        <a
          key={`${row.title}-${item.href}-${index}`}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="text-[#818cf8] text-[11.5px] inline-flex items-center gap-[5px] hover:underline"
        >
          <EyeIcon className="w-[12px] h-[12px] flex-shrink-0" />
          <span>{item.label || `Screenshot ${index + 1}`}</span>
        </a>
      ))}
    </div>
  );
}

function evidenceWithScreenshotFallback(evidence: Evidence[], run: TestRunResult): Evidence[] {
  const hasScreenshotHref = evidence.some(item => item.kind === 'screenshot' && item.href);
  if (hasScreenshotHref) return evidence;

  const finalScreenshots = run.ui.evidence.filter(item => item.kind === 'screenshot' && item.href);
  return finalScreenshots.length ? [...evidence, ...finalScreenshots] : evidence;
}

function SuiteHeader({ icon, title, command, pass, duration, ok }: { icon: ReactNode; title: string; command: string; pass: string; duration: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-[11px] p-[13px_16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px]">
      <div className={`w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center ${ok ? 'bg-[rgba(129,140,248,0.14)] text-[#818cf8]' : 'bg-[rgba(251,113,133,0.14)] text-[#fb7185]'}`}>{icon}</div>
      <div>
        <div className="text-[14px] font-semibold text-[#e8ebf2]">{title}</div>
        <div className="font-mono text-[11.5px] text-[#6b7488] mt-[1px]"><span className={ok ? 'text-[#3ddc97]' : 'text-[#fb7185]'}>$</span> {command}</div>
      </div>
      <div className="ml-auto flex items-center gap-[12px]">
        <span className={`inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px] ${ok ? 'text-[#3ddc97] bg-[rgba(61,220,151,0.13)]' : 'text-[#fb7185] bg-[rgba(251,113,133,0.14)]'}`}>{pass}</span>
        <span className="text-[11px] text-[#6b7488]">{duration}</span>
      </div>
    </div>
  );
}
