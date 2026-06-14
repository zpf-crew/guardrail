import * as React from 'react';
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
  const screenshotItems = evidence.filter((item): item is Evidence & { href: string } =>
    item.kind === 'screenshot' && Boolean(item.href),
  );
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const progressScrollRef = React.useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = React.useRef(true);
  const latestIndex = Math.max(0, screenshotItems.length - 1);
  const selectedScreenshot = screenshotItems[selectedIndex] ?? screenshotItems[latestIndex];

  React.useEffect(() => {
    if (screenshotItems.length > 0) setSelectedIndex(screenshotItems.length - 1);
  }, [screenshotItems.length]);

  React.useLayoutEffect(() => {
    const node = progressScrollRef.current;
    if (!node || !shouldStickToBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [progress.length]);

  const handleProgressScroll = () => {
    const node = progressScrollRef.current;
    if (!node) return;
    shouldStickToBottomRef.current = isNearScrollBottom(node);
  };

  return (
    <div className="mb-[18px]">
      <BlockHeader label={title} count={evidence.length} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] gap-[14px] items-start">
        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] min-h-[178px] min-w-0 flex flex-col">
          <div className="flex items-center gap-[8px] text-[12px] font-semibold text-[#98a1b3] uppercase tracking-[0.5px] mb-[10px]">
            {running && <LoaderIcon className="w-[13px] h-[13px] animate-spin text-[#818cf8] flex-shrink-0" />}
            <span>Progress stream</span>
          </div>
          <div
            ref={progressScrollRef}
            onScroll={handleProgressScroll}
            className="flex flex-col gap-[8px] max-h-[240px] overflow-y-auto pr-[4px] min-h-0"
          >
            {progress.length === 0 && (
              <div className="text-[12.5px] text-[#6b7488]">Waiting for run progress...</div>
            )}
            {progress.map((event, index) => (
              <div key={`${event.jobId}-${index}-${event.type}-${eventLabel(event)}`} className="text-[12.5px] text-[#98a1b3] leading-[1.45] min-w-0">
                <div className="text-[#818cf8] font-mono text-[11px]">{event.type}</div>
                <div className="min-w-0 break-words">{eventLabel(event)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] min-h-[178px] min-w-0">
          <div className="flex items-center justify-between gap-[12px] mb-[10px]">
            <div className="text-[12px] font-semibold text-[#98a1b3] uppercase tracking-[0.5px]">Screenshot timeline</div>
            {screenshotItems.length > 0 && (
              <div className="font-mono text-[11px] text-[#6b7488]">
                {Math.min(selectedIndex + 1, screenshotItems.length)} / {screenshotItems.length}
              </div>
            )}
          </div>

          {selectedScreenshot ? (
            <div className="min-w-0">
              <a href={selectedScreenshot.href} target="_blank" rel="noreferrer" className="block group min-w-0">
                <img
                  key={`${selectedScreenshot.href}-${selectedIndex}`}
                  src={selectedScreenshot.href}
                  alt={selectedScreenshot.label}
                  className="w-full aspect-video object-cover rounded-[8px] border border-[rgba(255,255,255,0.09)] bg-[#0d0f16]"
                />
                <div className="flex items-center gap-[6px] text-[11.5px] text-[#818cf8] mt-[8px] group-hover:underline min-w-0">
                  <EyeIcon className="w-[12px] h-[12px] flex-shrink-0" />
                  <span className="truncate">{selectedScreenshot.label}</span>
                </div>
              </a>

              <div className="mt-[12px] overflow-x-auto pb-[2px]">
                <div className="flex gap-[8px] min-w-0">
                  {screenshotItems.map((item, index) => {
                    const selected = item.href === selectedScreenshot.href && index === selectedIndex;
                    return (
                      <button
                        key={`${item.href}-${index}`}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={[
                          'relative w-[92px] flex-shrink-0 rounded-[8px] border p-[3px] text-left transition-[border-color,background-color,opacity]',
                          selected
                            ? 'border-[#818cf8] bg-[rgba(129,140,248,0.13)]'
                            : 'border-[rgba(255,255,255,0.08)] bg-[#0d0f16] opacity-75 hover:opacity-100 hover:border-[rgba(129,140,248,0.5)]',
                        ].join(' ')}
                        aria-label={`Show screenshot ${index + 1}: ${item.label}`}
                      >
                        <img
                          src={item.href}
                          alt=""
                          className="w-full aspect-video object-cover rounded-[5px] bg-[#090b10]"
                        />
                        <div className="mt-[4px] flex items-center gap-[5px]">
                          <span className={[
                            'w-[16px] h-[16px] rounded-full grid place-items-center text-[9.5px] font-mono font-bold',
                            selected ? 'bg-[#818cf8] text-white' : 'bg-[rgba(255,255,255,0.07)] text-[#98a1b3]',
                          ].join(' ')}>
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate text-[10.5px] text-[#98a1b3]">{item.label}</span>
                        </div>
                        {running && index === latestIndex && (
                          <span className="absolute right-[6px] top-[6px] w-[7px] h-[7px] rounded-full bg-[#3ddc97] shadow-[0_0_0_3px_rgba(61,220,151,0.2)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : evidence.length > 0 ? (
            <div className="text-[12.5px] text-[#fbbf24] flex gap-[8px] leading-[1.45]">
              <WarningTriangleIcon className="w-[15px] h-[15px] flex-shrink-0 mt-[2px]" />
              <span>Evidence was captured, but no displayable screenshot URL is available.</span>
            </div>
          ) : (
            <div className="h-[150px] rounded-[8px] border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0d0f16] grid place-items-center text-[12.5px] text-[#6b7488]">
              No screenshot captured yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isNearScrollBottom(node: HTMLElement): boolean {
  return node.scrollHeight - node.scrollTop - node.clientHeight <= 24;
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
