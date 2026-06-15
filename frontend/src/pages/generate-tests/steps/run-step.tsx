import { Fragment, useState, type ReactNode } from 'react';
import type { Evidence, TestRunResult, RunOutcome, TestType, TestResultRow } from '@/types/testlens';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RunResultIcon, MonitorIcon, EyeIcon, LoaderIcon } from '@/components/icons';
import { StepHeader, BlockHeader } from '../shared';
import { RUN_OUTCOME_STYLE, showsUiRunSuite } from '../workbench-presentation';
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
  onRunWithUrl: (manualBaseUrl: string) => void;
  onReview: () => void;
}

export function RunStep({ run, activeTestType, ranTests, running, progress, evidence, onBack, onRunWithUrl, onReview }: RunStepProps) {
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(() => new Set());
  const [manualUrl, setManualUrl] = useState('');
  const failedAutoRun = Boolean(run && !running && run.ui.outcome === 'Failed');

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
        </div>
      )}

      {complete && showsUiRunSuite(activeTestType) && failedAutoRun && (
        <div className="mb-[18px] rounded-[8px] border border-[rgba(129,140,248,0.22)] bg-[rgba(129,140,248,0.07)] p-[14px]">
          <BlockHeader label="Run against existing app URL" />
          <div className="text-[12px] leading-[1.45] text-[#aeb8ca] mb-[10px]">
            If Guardrail cannot start this repo inside AgentBase, provide a running preview or staging URL and rerun the UI Browser flow there.
          </div>
          <div className="flex gap-[8px]">
            <input
              value={manualUrl}
              onChange={event => setManualUrl(event.target.value)}
              placeholder="https://preview.example.com"
              className="min-w-0 flex-1 rounded-[7px] border border-[rgba(255,255,255,0.11)] bg-[#0b0d13] px-[10px] py-[8px] text-[12.5px] text-[#e8ebf2] outline-none focus:border-[#818cf8]"
            />
            <Button
              variant="primary"
              disabled={!manualUrl.trim()}
              onClick={() => onRunWithUrl(manualUrl.trim())}
            >
              Run URL
            </Button>
          </div>
        </div>
      )}

      <div className="mb-[18px]">
        <BlockHeader label="Test results" count={complete ? total : undefined} />
        <table className="w-full border-collapse text-[12.5px] mt-[4px]">
          <thead>
            <tr>{['Test', 'Status', 'Duration', 'Evidence', 'File'].map(h => (
              <th key={h} className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {revealed.map((row, index) => {
              const style = RUN_OUTCOME_STYLE[row.status];
              const rowKey = `${row.title}-${row.file}-${index}`;
              const reasonExpanded = expandedReasons.has(rowKey);
              return (
                <Fragment key={rowKey}>
                  <tr className="hover:bg-[rgba(255,255,255,0.018)]">
                    <td className={`p-[11px_12px] ${row.reason ? 'border-b-0' : 'border-b'} border-[rgba(255,255,255,0.07)] text-[#e8ebf2] font-medium`}>
                      <div>{row.title}</div>
                      <div className="mt-[5px]">
                        <span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{row.type}</span>
                      </div>
                    </td>
                    <td className={`p-[11px_12px] ${row.reason ? 'border-b-0' : 'border-b'} border-[rgba(255,255,255,0.07)]`}>
                      <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px]" style={{ background: style.bg, color: style.color }}>
                        <RunResultIcon status={ICON_STATUS[row.status]} />{row.status}
                      </span>
                    </td>
                    <td className={`p-[11px_12px] ${row.reason ? 'border-b-0' : 'border-b'} border-[rgba(255,255,255,0.07)] text-[#98a1b3] whitespace-nowrap`}>{row.duration ?? '—'}</td>
                    <td className={`p-[11px_12px] ${row.reason ? 'border-b-0' : 'border-b'} border-[rgba(255,255,255,0.07)] min-w-[150px]`}>
                      <MatrixEvidenceCell row={row} />
                    </td>
                    <td className={`p-[11px_12px] ${row.reason ? 'border-b-0' : 'border-b'} border-[rgba(255,255,255,0.07)] font-mono text-[11px] text-[#6b7488] max-w-[260px] break-all`}>{row.file}</td>
                  </tr>
                  {row.reason && (
                    <tr className="hover:bg-[rgba(255,255,255,0.012)]">
                      <td colSpan={5} className="p-[0_12px_12px_12px] border-b border-[rgba(255,255,255,0.07)]">
                        <RunReasonDetail
                          status={row.status}
                          reason={row.reason}
                          expanded={reasonExpanded}
                          onToggle={() => {
                            setExpandedReasons(current => {
                              const next = new Set(current);
                              if (next.has(rowKey)) next.delete(rowKey);
                              else next.add(rowKey);
                              return next;
                            });
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
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

function RunReasonDetail({
  status,
  reason,
  expanded,
  onToggle,
}: {
  status: RunOutcome;
  reason: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = reasonTone(status);
  const isLong = reason.length > 140;

  return (
    <div className={`rounded-[8px] border px-[12px] py-[9px] ${tone.container}`}>
      <div className="flex items-start gap-[10px]">
        <div className={`text-[10.5px] uppercase tracking-[0.5px] font-bold shrink-0 mt-[2px] ${tone.labelColor}`}>{tone.label}</div>
        <div className="min-w-0 flex-1">
          <div
            className={`text-[11.5px] leading-[1.45] break-words ${tone.textColor}`}
            style={expanded || !isLong ? undefined : {
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {reason}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={onToggle}
              className={`mt-[6px] text-[11px] font-semibold hover:underline ${tone.labelColor}`}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function reasonTone(status: RunOutcome): {
  label: string;
  container: string;
  labelColor: string;
  textColor: string;
} {
  if (status === 'Skipped') {
    return {
      label: 'Skipped',
      container: 'bg-[rgba(96,165,250,0.07)] border-[rgba(96,165,250,0.18)]',
      labelColor: 'text-[#8fb7f4]',
      textColor: 'text-[#aeb8ca]',
    };
  }
  if (status === 'Flaky') {
    return {
      label: 'Flaky signal',
      container: 'bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.18)]',
      labelColor: 'text-[#fbbf24]',
      textColor: 'text-[#d8c48b]',
    };
  }
  if (status === 'Failed') {
    return {
      label: 'Failure',
      container: 'bg-[rgba(251,113,133,0.08)] border-[rgba(251,113,133,0.2)]',
      labelColor: 'text-[#fb7185]',
      textColor: 'text-[#f2b8c0]',
    };
  }
  return {
    label: 'Detail',
    container: 'bg-[rgba(139,148,167,0.08)] border-[rgba(139,148,167,0.16)]',
    labelColor: 'text-[#98a1b3]',
    textColor: 'text-[#aeb8ca]',
  };
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
