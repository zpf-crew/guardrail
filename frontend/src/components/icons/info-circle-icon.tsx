import type { IconProps } from './types';

export function InfoCircleIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 8v8M12 5.5v.5"/><circle cx="12" cy="12" r="9"/>
    </svg>
  );
}
