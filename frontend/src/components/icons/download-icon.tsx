import type { IconProps } from './types';

export function DownloadIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 21h14"/>
    </svg>
  );
}
