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
  const progressItems = progress
    .map(formatProgressEvent)
    .filter((item): item is DisplayProgressItem => item !== null);
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
  }, [progressItems.length]);

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
            {progressItems.length === 0 && (
              <div className="text-[12.5px] text-[#6b7488]">Waiting for run progress...</div>
            )}
            {progressItems.map((item, index) => (
              <div
                key={`${item.key}-${index}`}
                title={item.raw}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-[9px] text-[12.5px] text-[#98a1b3] leading-[1.45] min-w-0"
              >
                <span className={[
                  'mt-[5px] w-[7px] h-[7px] rounded-full flex-shrink-0',
                  item.tone === 'success' ? 'bg-[#3ddc97]' : item.tone === 'warning' ? 'bg-[#fbbf24]' : 'bg-[#818cf8]',
                ].join(' ')} />
                <div className="min-w-0">
                  {item.meta && (
                    <div className="text-[10.5px] uppercase tracking-[0.45px] text-[#6b7488] font-semibold">{item.meta}</div>
                  )}
                  <div className="min-w-0 break-words text-[#c8ceda]">{item.label}</div>
                  {item.detail && (
                    <div className="min-w-0 break-words text-[11.5px] text-[#6b7488] mt-[1px]">{item.detail}</div>
                  )}
                </div>
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

interface DisplayProgressItem {
  key: string;
  label: string;
  raw: string;
  detail?: string;
  meta?: string;
  tone: 'info' | 'success' | 'warning';
}

type DisplayProgressContent = Pick<DisplayProgressItem, 'label' | 'detail' | 'meta'> & {
  tone?: DisplayProgressItem['tone'];
};

function formatProgressEvent(event: RunProgressEvent): DisplayProgressItem | null {
  const raw = eventLabel(event);
  if (event.type === 'status') {
    return null;
  }

  if (event.type === 'error') {
    return {
      key: `${event.jobId}-${event.type}-${raw}`,
      label: raw,
      raw,
      tone: 'warning',
    };
  }

  const formatted = formatProgressMessage(raw);
  return {
    key: `${event.jobId}-${event.type}-${raw}`,
    raw,
    tone: formatted.tone ?? 'info',
    ...formatted,
  };
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

function formatProgressMessage(raw: string): DisplayProgressContent {
  const { percent, message } = stripPercent(raw);
  const flow = message.match(/^\[Flow\s+([^\]]+)\]\s+(.+)$/);
  if (flow) {
    const parsed = formatFlowMessage(flow[2] ?? '');
    return {
      ...parsed,
      meta: parsed.meta ?? readableFlowLabel(flow[1] ?? 'Flow'),
    };
  }

  const behavior = message.match(/^\[Behavior\s+(\d+)\/(\d+)\]\s+Reducing generated scenarios into user flows/i);
  if (behavior) {
    return {
      label: 'Building user flows',
      meta: `Behavior ${behavior[1]} of ${behavior[2]}`,
    };
  }

  if (/^Running UI Browser tests\.?$/i.test(message)) return withPercent('Running UI browser tests', percent);
  if (/^Starting managed dev server\.?$/i.test(message)) return withPercent('Starting dev server', percent);
  if (/^Dev server ready at /i.test(message)) return withPercent('Dev server ready', percent);
  if (/^Summarizing run evidence for review/i.test(message)) return withPercent('Summarizing evidence', percent);
  if (/^Review summary ready/i.test(message)) return withPercent('Review summary ready', percent);

  return withPercent(cleanSentence(message), percent);
}

function formatFlowMessage(message: string): DisplayProgressContent {
  const action = message.match(/^agent-browser\s+(.+?)\s+—\s+Step\s+(\d+)\/(\d+)\s+—\s+(.+)$/);
  if (action) {
    const command = action[1] ?? '';
    const step = formatStepText(action[4] ?? '');
    return {
      label: actionLabel(command, step.instruction),
      detail: step.criteria,
      meta: `Step ${action[2]} of ${action[3]}`,
    };
  }

  const done = message.match(/^(Done|Verified|Check failed)\s+—\s+Step\s+(\d+)\/(\d+)\s+—\s+(.+)$/);
  if (done) {
    const status = done[1] ?? '';
    const step = formatStepText(done[4] ?? '');
    return {
      label: status === 'Verified' ? `Verified: ${sentenceCase(step.instruction)}` : status === 'Done' ? `Completed: ${sentenceCase(step.instruction)}` : `Check failed: ${sentenceCase(step.instruction)}`,
      detail: step.criteria,
      meta: `Step ${done[2]} of ${done[3]}`,
    };
  }

  if (/^Scenario complete/i.test(message)) {
    return { label: 'Flow completed', tone: 'success' };
  }

  return { label: cleanSentence(message) };
}

function stripPercent(raw: string): { percent: string | null; message: string } {
  const match = raw.match(/^(\d+)%\s+-\s+(.+)$/);
  return match ? { percent: match[1] ?? null, message: match[2] ?? raw } : { percent: null, message: raw };
}

function withPercent(label: string, percent: string | null): DisplayProgressContent {
  return { label, meta: percent ? `${percent}%` : undefined };
}

function formatStepText(value: string): { instruction: string; criteria?: string } {
  const withoutKind = value.replace(/^(Given|When|Then):\s*/i, '');
  const match = withoutKind.match(/^(.+?)\s+\((.+)\)$/);
  return {
    instruction: cleanSentence(match?.[1] ?? withoutKind),
    criteria: match?.[2] ? cleanSentence(match[2]) : undefined,
  };
}

function actionLabel(command: string, instruction: string): string {
  if (/^click\b/i.test(command)) return simplifyClickInstruction(instruction);
  if (/^fill\b/i.test(command)) return simplifySearchInstruction(instruction) ?? `Enter text: ${sentenceCase(instruction)}`;
  if (/^press\s+Enter/i.test(command)) return 'Submit search';
  if (/^get\s+url/i.test(command)) return 'Check current page';
  if (/^get\s+text/i.test(command)) return `Read page text: ${sentenceCase(instruction)}`;
  if (/^scroll/i.test(command)) return 'Scroll to find the target';
  if (/^wait/i.test(command)) return 'Wait for page update';
  return sentenceCase(instruction);
}

function simplifyClickInstruction(instruction: string): string {
  const addToCart = instruction.match(/add to cart/i);
  if (addToCart) return 'Click Add to Cart';
  const cart = instruction.match(/cart (icon|link|button)|shopping cart/i);
  if (cart) return 'Open cart';
  const wishlist = instruction.match(/wishlist|heart/i);
  if (wishlist) return 'Click wishlist';
  return `Click: ${sentenceCase(instruction)}`;
}

function simplifySearchInstruction(instruction: string): string | null {
  if (!/search/i.test(instruction)) return null;
  const quoted = instruction.match(/"([^"]+)"/);
  return quoted ? `Enter search term "${quoted[1]}"` : 'Enter search term';
}

function readableFlowLabel(value: string): string {
  const match = value.match(/^flow-(\d+)$/i);
  return match ? `Flow ${match[1]}` : value;
}

function cleanSentence(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/\.$/, '');
}

function sentenceCase(value: string): string {
  const clean = cleanSentence(value);
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
