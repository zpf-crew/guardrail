import type { IconProps } from './types';

export function AlignLeftIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M4 6h16M4 12h16M4 18h10"/>
    </svg>
  );
}
