import type { IconProps } from './types';

export function WarningTriangleIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 8v5M12 16v.5" /><path d="M10.3 4l-7 12.5A1.5 1.5 0 004.6 19h14.8a1.5 1.5 0 001.3-2.5L13.7 4a1.5 1.5 0 00-3.4 0z" />
    </svg>
  );
}
