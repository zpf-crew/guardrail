import { AlignLeftIcon, FileDocIcon, FileCodeIcon } from '@/components/icons';

/** Step eyebrow + title + description block. */
export function StepHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-[20px]">
      <div className="text-[11px] font-bold tracking-[0.9px] text-[#818cf8] uppercase mb-[8px]">{eyebrow}</div>
      <h1 className="text-[23px] font-semibold text-white tracking-[-0.4px] mb-[7px] leading-[1.3]">{title}</h1>
      {description && <p className="text-[14px] text-[#98a1b3] max-w-[720px] leading-[1.55]">{description}</p>}
    </div>
  );
}

/** Small uppercase section label with an optional count chip. */
export function BlockHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-[9px] text-[12px] font-semibold uppercase tracking-[0.6px] text-[#98a1b3] mb-[13px]">
      <AlignLeftIcon className="w-[15px] h-[15px] text-[#818cf8]" />
      {label}
      {count !== undefined && <span className="font-mono text-[11px] text-[#6b7488] bg-[#0d0f16] px-[8px] py-[1px] rounded-full">{count}</span>}
    </div>
  );
}

/** File-type glyph used in source/spec lists. */
export function FileIcon({ type }: { type: 'code' | 'doc' }) {
  return type === 'doc'
    ? <FileDocIcon className="w-[14px] h-[14px] text-[#fbbf24]" />
    : <FileCodeIcon className="w-[14px] h-[14px] text-[#818cf8]" />;
}
