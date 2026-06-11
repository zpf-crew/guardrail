import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-[#161a24] border border-[rgba(255,255,255,0.12)] text-[#e8ebf2] hover:bg-[#1b2030]',
      outline: 'border border-[rgba(255,255,255,0.12)] bg-transparent text-[#98a1b3] hover:bg-[#161a24] hover:text-[#e8ebf2]',
      primary: 'bg-gradient-to-br from-[#8b93ff] to-[#5d68f0] border-transparent text-white hover:shadow-[0_6px_22px_rgba(99,102,241,0.5)]',
      ghost: 'bg-transparent border-transparent text-[#98a1b3] hover:bg-[#161a24] hover:text-[#e8ebf2]',
      danger: 'bg-transparent border-[rgba(251,113,133,0.3)] text-[#fb7185] hover:bg-[rgba(251,113,133,0.14)]',
    };
    const sizes = {
      default: 'px-[15px] py-[9px] text-[13px]',
      lg: 'px-[22px] py-[12px] text-[14.5px]',
    };
    return (
      <button ref={ref} className={cn('inline-flex items-center gap-[7px] font-medium rounded-[9px] cursor-pointer transition-all duration-[0.14s] ease whitespace-nowrap hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none', variants[variant], sizes[size], className)} {...props} />
    );
  }
);
Button.displayName = 'Button';
export { Button };
