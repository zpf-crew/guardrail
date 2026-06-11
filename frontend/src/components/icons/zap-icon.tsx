import type { IconProps } from './types';

export function ZapIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M13 3L4 14h7l-1 7 9-11h-7z"/>
    </svg>
  );
}
