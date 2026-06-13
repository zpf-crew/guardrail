import type { Evidence } from '@/types/testlens';
import { EyeIcon, LoaderIcon, WarningTriangleIcon } from '@/components/icons';
import { BlockHeader } from './shared';
import type { RunProgressEvent } from './use-workbench';

interface EvidencePanelProps {
  title?: string;
  running?: boolean;
  progress: RunProgressEvent[];
  evidence: Evidence[];
}

export function EvidencePanel({ title = 'Evidence', running = false, progress, evidence }: EvidencePanelProps) {
  const recentProgress = progress
    .map((event, index) => ({ event, index }))
    .slice(-8);
  const latestScreenshot = [...evidence].reverse().find(item => item.kind === 'screenshot' && item.href);

  return (
    <div className="mb-[18px]">
      <BlockHeader label={title} count={evidence.length} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] gap-[14px] items-start">
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] min-h-[178px] min-w-0">
          <div className="flex items-center gap-[8px] text-[12px] font-semibold text-[#98a1b3] uppercase tracking-[0.5px] mb-[10px]">
            {running && <LoaderIcon className="w-[13px] h-[13px] animate-spin text-[#818cf8] flex-shrink-0" />}
            <span>Progress stream</span>
          </div>
          <div className="flex flex-col gap-[8px]">
            {recentProgress.length === 0 && (
              <div className="text-[12.5px] text-[#6b7488]">Waiting for run progress...</div>
            )}
            {recentProgress.map(({ event, index }) => (
              <div key={`${event.jobId}-${index}-${event.type}-${eventLabel(event)}`} className="text-[12.5px] text-[#98a1b3] leading-[1.45] flex gap-[8px] min-w-0">
                <span className="text-[#818cf8] font-mono text-[11px] mt-[1px] flex-shrink-0">{event.type}</span>
                <span className="min-w-0 break-words">{eventLabel(event)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] min-h-[178px] min-w-0">
          <div className="text-[12px] font-semibold text-[#98a1b3] uppercase tracking-[0.5px] mb-[10px]">Latest screenshot</div>
          {latestScreenshot ? (
            <a href={latestScreenshot.href} target="_blank" rel="noreferrer" className="block group min-w-0">
              <img
                src={latestScreenshot.href}
                alt={latestScreenshot.label}
                className="w-full aspect-video object-cover rounded-[8px] border border-[rgba(255,255,255,0.09)] bg-[#0d0f16]"
              />
              <div className="flex items-center gap-[6px] text-[11.5px] text-[#818cf8] mt-[8px] group-hover:underline min-w-0">
                <EyeIcon className="w-[12px] h-[12px] flex-shrink-0" />
                <span className="truncate">{latestScreenshot.label}</span>
              </div>
            </a>
          ) : evidence.length > 0 ? (
            <div className="text-[12.5px] text-[#fbbf24] flex gap-[8px] leading-[1.45]">
              <WarningTriangleIcon className="w-[15px] h-[15px] flex-shrink-0 mt-[2px]" />
              <span>Evidence was captured, but no displayable screenshot URL is available.</span>
            </div>
          ) : (
            <div className="text-[12.5px] text-[#6b7488]">No screenshot captured yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function eventLabel(event: RunProgressEvent): string {
  if ('message' in event) {
    if (event.type === 'progress' && typeof event.percent === 'number') {
      return `${event.percent}% - ${event.message}`;
    }
    return event.message;
  }
  return event.status;
}
