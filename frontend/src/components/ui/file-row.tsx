import { CheckIcon, XIcon } from '@/components/icons';

export interface FileRowProps {
  name: string;
  type: string;
  size: string;
  status?: string;
  onDelete?: () => void;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  pdf: { bg: 'rgba(251,113,133,0.14)', text: '#fb7185' },
  md: { bg: 'rgba(96,165,250,0.14)', text: '#60a5fa' },
  txt: { bg: 'rgba(139,148,167,0.16)', text: '#8b94a7' },
  csv: { bg: 'rgba(61,220,151,0.14)', text: '#3ddc97' },
  json: { bg: 'rgba(251,191,36,0.14)', text: '#fbbf24' },
  xlsx: { bg: 'rgba(61,220,151,0.16)', text: '#3ddc97' },
};

export function FileRow({ name, type, size, status, onDelete }: FileRowProps) {
  const colors = typeColors[type] || typeColors.txt;
  return (
    <div className="flex items-center gap-[12px] p-[11px_13px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[10px]">
      <div className="w-[34px] h-[34px] rounded-[8px] flex-none grid place-items-center font-mono text-[9.5px] font-bold tracking-[0.5px]" style={{ background: colors.bg, color: colors.text }}>
        {type.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#e8ebf2]">{name}</div>
        <div className="text-[11.5px] text-[#6b7488] mt-[1px] font-mono">{size}</div>
      </div>
      {status && (
        <span className="text-[11px] text-[#3ddc97] inline-flex items-center gap-[5px]">
          <CheckIcon strokeWidth={2.4} className="w-[13px] h-[13px]" />
          {status}
        </span>
      )}
      {onDelete && (
        <button aria-label="Delete file" onClick={onDelete} className="bg-transparent border-none text-[#6b7488] cursor-pointer p-[6px] rounded-[6px] grid place-items-center hover:text-[#fb7185] hover:bg-[rgba(251,113,133,0.14)]">
          <XIcon className="w-[15px] h-[15px]" />
        </button>
      )}
    </div>
  );
}
