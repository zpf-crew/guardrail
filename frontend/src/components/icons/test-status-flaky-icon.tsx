import type { IconProps } from './types';

export function TestStatusFlakyIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 7v5l3 2M12 12a8.5 8.5 0 100 0 8.5 8.5 0 000 0z"/>
    </svg>
  );
}
