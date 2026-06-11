import type { IconProps } from './types';

export function TrendUpIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M5 15l5-5 4 4 6-7"/>
    </svg>
  );
}
