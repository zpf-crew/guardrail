export const WORKFLOW_STEPS = [
  { title: 'Intent' },
  { title: 'Isolation' },
  { title: 'Plan' },
  { title: 'Generate' },
  { title: 'Run' },
  { title: 'Review' },
];

interface WorkflowSidebarProps {
  currentStep: number;
  /** When true the workflow is finished — every step renders as done. */
  applied?: boolean;
  onSelect: (i: number) => void;
}

/** Left rail showing the 6 workflow steps; completed steps are clickable. */
export function WorkflowSidebar({ currentStep, applied = false, onSelect }: WorkflowSidebarProps) {
  return (
    <div className="w-[218px] min-h-screen border-r border-[rgba(255,255,255,0.07)] p-[22px_16px] flex-shrink-0">
      <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[16px] mx-[6px]">Workflow</div>
      <div className="flex flex-col mb-[16px] relative">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = applied || i < currentStep;
          const active = !applied && i === currentStep;
          return (
            <div
              key={step.title}
              className={`relative flex gap-[12px] p-[10px_11px] rounded-[11px] cursor-pointer text-[13px] transition-all border border-transparent mb-[2px] ${
                active ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.25)] shadow-[0_0_0_1px_rgba(129,140,248,0.12)]' :
                done ? 'text-[#3ddc97] hover:bg-[rgba(255,255,255,0.025)]' :
                'text-[#6b7488] hover:bg-[rgba(255,255,255,0.025)]'
              }`}
              onClick={() => { if (i <= currentStep) onSelect(i); }}
            >
              <span className={`w-[26px] h-[26px] rounded-full flex-shrink-0 grid place-items-center text-[12px] font-mono font-semibold transition-all relative ${
                done ? 'bg-[rgba(61,220,151,0.13)] border-[rgba(61,220,151,0.5)] text-[#3ddc97]' :
                active ? 'border-[1.5px] border-[#818cf8] text-[#818cf8] bg-[#11141c]' :
                'border-[1.5px] border-[rgba(255,255,255,0.12)] text-[#6b7488] bg-[#0d0f16]'
              }`}>
                {done ? '✓' : i + 1}
              </span>
              <div className="pt-[3px]">
                <div className={`text-[13.5px] font-semibold ${active ? 'text-white' : 'text-[#e8ebf2]'}`}>{step.title}</div>
                <div className={`text-[11px] mt-[1px] ${done ? 'text-[#3ddc97]' : active ? 'text-[#818cf8]' : 'text-[#6b7488]'}`}>
                  {done ? 'Done' : active ? 'Active' : 'Pending'}
                </div>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="absolute left-[23.5px] top-[38px] w-[1.5px] h-[calc(100%-24px)] bg-[rgba(255,255,255,0.12)]" />
              )}
              {done && i < WORKFLOW_STEPS.length - 1 && (
                <div className="absolute left-[23.5px] top-[38px] w-[1.5px] h-[calc(100%-24px)] bg-[rgba(61,220,151,0.4)]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
