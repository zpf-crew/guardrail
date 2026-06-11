import type { IconProps } from './types';

export function SmartphoneIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" x2="12" y1="18" y2="18" />
    </svg>
  );
}
