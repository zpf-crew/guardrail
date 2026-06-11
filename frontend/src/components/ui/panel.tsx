import * as React from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#11141c] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]',
        className
      )}
      {...props}
    />
  )
);
Panel.displayName = 'Panel';
