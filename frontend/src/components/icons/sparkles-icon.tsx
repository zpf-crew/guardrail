import type { IconProps } from './types';

export function SparklesIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 3v18M3 12h18" opacity="0"/><path d="M9 3v4M7 5h4"/><path d="M15 8l1.5 3.5L20 13l-3.5 1.5L15 18l-1.5-3.5L10 13l3.5-1.5z"/>
    </svg>
  );
}
