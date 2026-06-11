import { cn } from '@/lib/cn';

export interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div role="tablist" className="inline-flex bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] p-[3px] gap-[2px]">
      {options.map(opt => (
        <button key={opt.value} role="tab" aria-selected={value === opt.value} onClick={() => onChange(opt.value)} className={cn('font-sans text-[12.5px] font-medium px-[12px] py-[6px] rounded-[6px] cursor-pointer transition-all whitespace-nowrap border-none', value === opt.value ? 'bg-[#1b2030] text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]' : 'bg-transparent text-[#98a1b3] hover:text-[#e8ebf2]')}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
