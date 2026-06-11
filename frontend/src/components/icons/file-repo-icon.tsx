import type { IconProps } from './types';

export function FileRepoIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M4 3h11l5 5v13H4z" /><path d="M15 3v5h5" />
    </svg>
  );
}
