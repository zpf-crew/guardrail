import type { IconProps } from './types';

export function ChevronUpIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M6 14l6-6 6 6"/>
    </svg>
  );
}
