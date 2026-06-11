import type { IconProps } from './types';

export function ArrowLeftIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6"/>
    </svg>
  );
}
