import * as React from 'react';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Button } from '@/components/ui/button';
import { logTagClass, logTagSymbol } from '@/lib/scan-log-format';
import type { ScanProgressLog } from './use-scan-progress';

interface ScanProgressOverlayProps {
  open: boolean;
  repoName: string;
  running: boolean;
  complete: boolean;
  error: string | null;
  progress: number;
  stepLabel: string;
  eta: string;
  logs: ScanProgressLog[];
  onClose: () => void;
}

/** Modal overlay that mirrors the onboarding scan feed while a dashboard re-scan runs. */
export function ScanProgressOverlay({ open, repoName, running, complete, error, progress, stepLabel, eta, logs, onClose }: ScanProgressOverlayProps) {
  const logRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  if (!open) return null;

  const title = error ? 'Scan failed' : complete ? 'Scan complete' : `Scanning ${repoName}…`;
  const subtitle = error
    ? error
    : complete
      ? 'Dashboard updated with the latest results.'
      : 'Guardrail is analyzing your repository. This can take a moment while tests and coverage run.';

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(4,6,10,0.72)] backdrop-blur-[2px] p-[24px]">
      <div className="w-full max-w-[560px] bg-[#11141c] border border-[rgba(255,255,255,0.1)] rounded-[16px] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="p-[20px_22px] border-b border-[rgba(255,255,255,0.07)]">
          <div className="text-[15px] font-semibold text-white">{title}</div>
          <div className="text-[12.5px] text-[#98a1b3] mt-[3px]">{subtitle}</div>
        </div>

        <div className="p-[20px_22px]">
          <div className="flex items-baseline justify-between mb-[9px]">
            <span className="text-[13px] text-[#e8ebf2] font-medium">
              {stepLabel} <span className="text-[#818cf8] font-mono font-bold">{progress}%</span>
            </span>
            <span className="text-[11.5px] text-[#6b7488] font-mono">{eta}</span>
          </div>
          <ProgressBar value={progress} />

          <div
            ref={logRef}
            className="bg-[#07090d] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[14px_16px] max-h-[230px] overflow-y-auto font-mono text-[12.5px] leading-[1.7] mt-[16px]"
          >
            {logs.length === 0 ? (
              <div className="text-[#6b7488]">Preparing scan…</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-[10px]">
                  <span className="text-[#6b7488] flex-none">{log.at ? new Date(log.at).toTimeString().slice(0, 8) : new Date().toTimeString().slice(0, 8)}</span>
                  <span className="text-[#98a1b3]">
                    <span className={logTagClass(log.tag)}>{logTagSymbol(log.tag)}</span> {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-[16px_22px] border-t border-[rgba(255,255,255,0.07)] flex justify-end">
          <Button variant={complete || error ? 'primary' : 'ghost'} onClick={onClose} disabled={running}>
            {running ? 'Scanning…' : complete ? 'View results' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
}
