import * as React from 'react';
import { cn } from '@/lib/cn';
import { BrandIcon, FileRepoIcon, GitBranchIcon } from '@/components/icons';

export interface TopBarProps {
  repo?: string;
  branch?: string;
  scanTime?: string;
  actions?: React.ReactNode;
  contentClassName?: string;
  user?: {
    login: string;
    avatarUrl: string | null;
  } | null;
  onLogout?: () => void;
}

export function TopBar({ repo, branch, scanTime, actions, contentClassName, user, onLogout }: TopBarProps) {
  return (
    <header className="sticky top-0 z-[50] bg-[rgba(11,13,19,0.78)] backdrop-blur-[18px] saturate-[140%] border-b border-[rgba(255,255,255,0.07)]">
      <div className={cn('flex items-center gap-[22px] px-[26px] py-[12px] w-full', contentClassName)}>
      <div className="flex items-center gap-[11px] pr-[20px] border-r border-[rgba(255,255,255,0.07)]">
        <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.12)_inset]">
          <BrandIcon stroke="#fff" className="w-[19px] h-[19px]" />
        </div>
        <div className="text-[16px] font-semibold tracking-[-0.2px] text-[#e8ebf2]"><b className="text-white">Guard</b>rail</div>
        <span className="text-[9.5px] font-bold tracking-[1px] uppercase text-[#22d3ee] border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-[6px] py-[2px] rounded-[5px]">Agent</span>
      </div>
      {repo && (
        <div className="flex items-center gap-[8px] flex-wrap">
          <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] px-[11px] py-[6px] rounded-[8px] font-mono text-[12.5px] text-[#e8ebf2]">
            <FileRepoIcon className="w-[14px] h-[14px] opacity-[0.7]" />
            <span className="text-[#6b7488]">repo</span>&nbsp;{repo}
          </span>
          {branch && (
            <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] px-[11px] py-[6px] rounded-[8px] font-mono text-[12.5px] text-[#818cf8]">
              <GitBranchIcon className="w-[14px] h-[14px]" />
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
      {(actions || user || onLogout) && (
        <div className="ml-auto flex items-center gap-[9px]">
          {actions}
          {user && (
            <span className="inline-flex items-center gap-[8px] border-l border-[rgba(255,255,255,0.07)] pl-[12px] text-[12.5px] text-[#98a1b3]">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-[24px] w-[24px] rounded-full border border-[rgba(255,255,255,0.12)]" />
              ) : (
                <span className="h-[24px] w-[24px] rounded-full grid place-items-center bg-[#161a24] border border-[rgba(255,255,255,0.12)] text-[10px] uppercase">
                  {user.login.slice(0, 1)}
                </span>
              )}
              <span className="font-mono text-[#e8ebf2] max-w-[140px] truncate">{user.login}</span>
            </span>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-[12.5px] text-[#6b7488] bg-transparent border border-transparent rounded-[8px] px-[10px] py-[6px] cursor-pointer hover:text-[#e8ebf2] hover:bg-[#161a24] hover:border-[rgba(255,255,255,0.07)]"
            >
              Logout
            </button>
          )}
        </div>
      )}
      </div>
    </header>
  );
}
