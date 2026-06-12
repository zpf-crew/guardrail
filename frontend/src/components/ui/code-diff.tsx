import type { DiffLine } from '@/types/testlens';

export type { DiffLine };

export interface CodeDiffProps {
  diff: DiffLine[];
}

export function CodeDiff({ diff }: CodeDiffProps) {
  return (
    <div className="font-mono text-[12px] leading-[1.7] overflow-x-auto">
      {diff.map((line, i) => (
        <div
          key={`${line.kind}-${i}-${line.text.slice(0, 20)}`}
          className={
            line.kind === 'add'
              ? 'text-[#3ddc97] bg-[rgba(61,220,151,0.08)]'
              : line.kind === 'del'
                ? 'text-[#fb7185] bg-[rgba(251,113,133,0.08)]'
                : line.kind === 'meta'
                  ? 'text-[#22d3ee]'
                  : 'text-[#6b7488]'
          }
        >
          <pre className="whitespace-pre">{line.text}</pre>
        </div>
      ))}
    </div>
  );
}
