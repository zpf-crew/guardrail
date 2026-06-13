import { ProgressBar } from '@/components/ui/progress-bar';
import { LoaderIcon } from '@/components/icons';
import type { WorkbenchProgressEvent } from './use-workbench';

interface WorkbenchProgressPanelProps {
  active: boolean;
  title: string;
  fallbackMessage: string;
  events: WorkbenchProgressEvent[];
}

export function WorkbenchProgressPanel({ active, title, fallbackMessage, events }: WorkbenchProgressPanelProps) {
  if (!active) return null;

  const latest = [...events].reverse().find(event => event.type === 'progress');
  const percent = latest && 'percent' in latest && typeof latest.percent === 'number' ? latest.percent : 8;
  const message = latest && latest.type === 'progress' ? latest.message : fallbackMessage;

  return (
    <div className="mb-[22px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
      <div className="flex items-center justify-between gap-[12px] mb-[10px]">
        <div className="flex items-center gap-[8px] text-[12.5px] text-[#98a1b3]">
          <LoaderIcon className="w-[15px] h-[15px] animate-spin text-[#818cf8]" />
          <span>{title}: {message}</span>
        </div>
        <span className="font-mono text-[12px] text-[#818cf8]">{percent}%</span>
      </div>
      <ProgressBar value={percent} />
      <div className="mt-[12px] flex flex-col gap-[6px]">
        {events.slice(-5).map((event, index) => (
          <div key={`${event.jobId}-${index}-${event.type}`} className="text-[12px] text-[#6b7488] leading-[1.45]">
            <span className="text-[#818cf8] font-mono mr-[8px]">{event.type}</span>
            {event.type === 'progress' ? event.message : event.type === 'error' ? event.message : event.type === 'status' ? event.status : event.message}
          </div>
        ))}
      </div>
    </div>
  );
}
