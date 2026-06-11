import type { IconProps } from './types';

export function RefreshIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M4 12a8 8 0 108-8" /><path d="M4 4v4h4" />
    </svg>
  );
}
