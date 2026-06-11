import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TopBarProps {
  repo?: string;
  branch?: string;
  scanTime?: string;
  actions?: React.ReactNode;
  contentClassName?: string;
}

export function TopBar({ repo, branch, scanTime, actions, contentClassName }: TopBarProps) {
  return (
    <header className="sticky top-0 z-[50] bg-[rgba(11,13,19,0.78)] backdrop-blur-[18px] saturate-[140%] border-b border-[rgba(255,255,255,0.07)]">
      <div className={cn('flex items-center gap-[22px] px-[26px] py-[12px] w-full', contentClassName)}>
      <div className="flex items-center gap-[11px] pr-[20px] border-r border-[rgba(255,255,255,0.07)]">
        <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.12)_inset]">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-[19px] h-[19px]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M8 10.5l1.8 1.8L13.5 8.5" /></svg>
        </div>
        <div className="text-[16px] font-semibold tracking-[-0.2px] text-[#e8ebf2]"><b className="text-white">Guard</b>rail</div>
        <span className="text-[9.5px] font-bold tracking-[1px] uppercase text-[#22d3ee] border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-[6px] py-[2px] rounded-[5px]">Agent</span>
      </div>
      {repo && (
        <div className="flex items-center gap-[8px] flex-wrap">
          <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] px-[11px] py-[6px] rounded-[8px] font-mono text-[12.5px] text-[#e8ebf2]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] opacity-[0.7]"><path d="M4 3h11l5 5v13H4z" /><path d="M15 3v5h5" /></svg>
            <span className="text-[#6b7488]">repo</span>&nbsp;{repo}
          </span>
          {branch && (
            <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] px-[11px] py-[6px] rounded-[8px] font-mono text-[12.5px] text-[#818cf8]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M18 10.5c0 4-6 2-6 5.5" /></svg>
              {branch}
            </span>
          )}
        </div>
      )}
      {scanTime && (
        <div className="flex flex-col leading-[1.25] ml-[2px]">
          <span className="text-[10px] uppercase tracking-[0.7px] text-[#6b7488]">Last scan</span>
          <span className="text-[12.5px] text-[#98a1b3]"><span className="text-[#3ddc97]">●</span> {scanTime}</span>
        </div>
      )}
      {actions && <div className="ml-auto flex items-center gap-[9px]">{actions}</div>}
      </div>
    </header>
  );
}
