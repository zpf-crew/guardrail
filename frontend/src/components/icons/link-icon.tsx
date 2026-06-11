import type { IconProps } from './types';

export function LinkIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M9 12a3 3 0 003 3l3-3a3 3 0 00-4.2-4.2L11 9" /><path d="M15 12a3 3 0 00-3-3l-3 3a3 3 0 004.2 4.2L13 15" />
    </svg>
  );
}
