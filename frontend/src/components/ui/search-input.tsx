import * as React from 'react';
import { cn } from '@/lib/cn';
import { SearchIcon } from '@/components/icons';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, shortcut, ...props }, ref) => {
    return (
      <div className={cn('flex-1 min-w-[200px] flex items-center gap-[9px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] px-[12px] py-[9px] transition-[border-color,box-shadow] duration-150 focus-within:border-[rgba(129,140,248,0.35)] focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.14)]', className)}>
        <SearchIcon className="w-[16px] h-[16px] opacity-[0.55] flex-none" />
        <input ref={ref} className="flex-1 bg-transparent border-none outline-none text-[#e8ebf2] text-[13.5px] font-sans placeholder:text-[#6b7488]" {...props} />
        {shortcut && <kbd className="font-mono text-[10.5px] text-[#6b7488] border border-[rgba(255,255,255,0.07)] rounded-[5px] px-[6px] py-[1px] bg-[#161a24]">{shortcut}</kbd>}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
