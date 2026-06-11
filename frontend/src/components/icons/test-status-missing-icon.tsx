import type { IconProps } from './types';

export function TestStatusMissingIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 7v10M7 12h10"/>
    </svg>
  );
}
