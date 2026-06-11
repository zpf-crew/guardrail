export interface DiffLine {
  type: 'add' | 'del' | 'meta' | 'ctx';
  content: string;
}

export interface CodeDiffProps {
  diff: DiffLine[];
}

export function CodeDiff({ diff }: CodeDiffProps) {
  return (
    <div className="font-mono text-[12px] leading-[1.7] overflow-x-auto">
      {diff.map((line, i) => (
        <div key={i} className={line.type === 'add' ? 'text-[#3ddc97] bg-[rgba(61,220,151,0.08)]' : line.type === 'del' ? 'text-[#fb7185] bg-[rgba(251,113,133,0.08)]' : line.type === 'meta' ? 'text-[#22d3ee]' : 'text-[#6b7488]'}>
          <pre className="whitespace-pre">{line.content}</pre>
        </div>
      ))}
    </div>
  );
}
