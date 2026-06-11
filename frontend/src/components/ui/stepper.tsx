import { cn } from '@/lib/cn';

export interface Step {
  title: string;
  optional?: boolean;
  state: 'todo' | 'current' | 'done' | 'skipped';
}

export interface StepperProps {
  steps: Step[];
  activeStep: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, activeStep: _activeStep, onStepClick }: StepperProps) {
  const doneCount = steps.filter(s => s.state === 'done' || s.state === 'skipped').length;
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px] flex justify-between">
        <span>Setup progress</span>
        <span><b className="text-[#818cf8]">{doneCount}</b> / {steps.length}</span>
      </div>
      {steps.map((step, i) => {
        const isCurrent = step.state === 'current';
        const isDone = step.state === 'done';
        const isSkipped = step.state === 'skipped';
        return (
          <div key={i} className={cn('flex gap-[13px] p-[11px_12px] rounded-[11px] cursor-pointer relative transition-colors border border-transparent', isCurrent && 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.25)] shadow-[0_0_0_1px_rgba(129,140,248,0.15),0_6px_20px_rgba(99,102,241,0.15)]', !isCurrent && 'hover:bg-[rgba(255,255,255,0.025)]')} onClick={() => onStepClick?.(i)}>
            {i < steps.length - 1 && (
              <div className={cn('absolute left-[25.5px] top-[40px] h-[calc(100%-28px)] w-[1.5px] z-0', isDone ? 'bg-[rgba(61,220,151,0.4)]' : 'bg-[rgba(255,255,255,0.12)]')} />
            )}
            <div className={cn('w-[28px] h-[28px] rounded-full flex-none grid place-items-center text-[13px] font-semibold font-mono relative bg-[#0d0f16] border-[1.5px] border-[rgba(255,255,255,0.12)] text-[#6b7488] transition-all', isCurrent && 'border-[#818cf8] text-[#818cf8] bg-[#11141c]', isDone && 'bg-[rgba(61,220,151,0.13)] border-[rgba(61,220,151,0.5)] text-[#3ddc97]', isSkipped && 'border-dashed border-[rgba(255,255,255,0.12)] text-[#8b94a7]')}>
              {isDone ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[15px] h-[15px]"><path d="M5 12l4 4 10-10" /></svg> : isSkipped ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[15px] h-[15px]"><path d="M5 12h14" /></svg> : (i + 1)}
            </div>
            <div className="pt-[3px] min-w-0">
              <div className={cn('text-[13.5px] font-semibold', isCurrent ? 'text-white' : 'text-[#e8ebf2]')}>
                {step.title}
                {step.optional && <span className="text-[9.5px] font-bold tracking-[0.5px] uppercase text-[#6b7488] border border-[rgba(255,255,255,0.07)] rounded px-[5px] py-[1px] ml-[6px]">Opt</span>}
              </div>
              <div className={cn('text-[11px] mt-[2px] flex items-center gap-[5px]', isDone ? 'text-[#3ddc97]' : isCurrent ? 'text-[#818cf8]' : isSkipped ? 'text-[#8b94a7]' : 'text-[#6b7488]')}>
                {isCurrent && <span className="w-[5px] h-[5px] rounded-full bg-current" />}
                {isDone ? 'Completed' : isCurrent ? 'In progress' : isSkipped ? 'Skipped' : 'Not started'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
