import type { IconProps } from './types';

export function LayoutDashboardIcon({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M3 13h8V3H3zM13 21h8v-10h-8zM13 3v6h8V3zM3 21h8v-4H3z" />
    </svg>
  );
}
