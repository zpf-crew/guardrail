import * as React from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent';
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'gray', dot = false, children, ...props }, ref) => {
    const variants: Record<string, string> = {
      pass: 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]',
      fail: 'bg-[rgba(251,113,133,0.14)] text-[#fb7185]',
      flaky: 'bg-[rgba(251,191,36,0.14)] text-[#fbbf24]',
      missing: 'bg-[rgba(96,165,250,0.14)] text-[#60a5fa]',
      suspect: 'bg-[rgba(192,132,252,0.15)] text-[#c084fc]',
      gray: 'bg-[rgba(139,148,167,0.16)] text-[#8b94a7]',
      accent: 'bg-[rgba(129,140,248,0.14)] text-[#818cf8]',
    };
    const dotColors: Record<string, string> = {
      pass: 'bg-[#3ddc97]', fail: 'bg-[#fb7185]', flaky: 'bg-[#fbbf24]',
      missing: 'bg-[#60a5fa]', suspect: 'bg-[#c084fc]', gray: 'bg-[#8b94a7]', accent: 'bg-[#818cf8]',
    };
    return (
      <span ref={ref} className={cn('inline-flex items-center gap-[5px] text-[11px] font-semibold px-2 py-[2.5px] rounded-md leading-[1.4] whitespace-nowrap', variants[variant], className)} {...props}>
        {dot && <span className={cn('w-[6px] h-[6px] rounded-full', dotColors[variant])} />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
