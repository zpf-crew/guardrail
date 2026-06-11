export interface ProgressBarProps {
  value: number;
  max?: number;
}

export function ProgressBar({ value, max = 100 }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-[9px] rounded-[99px] bg-[#0d0f16] overflow-hidden border border-[rgba(255,255,255,0.07)]">
      <div className="h-full rounded-[99px] bg-gradient-to-r from-[#5d68f0] via-[#8b93ff] to-[#22d3ee] transition-[width] duration-500 shadow-[0_0_12px_rgba(129,140,248,0.5)]" style={{ width: `${pct}%` }} />
    </div>
  );
}
