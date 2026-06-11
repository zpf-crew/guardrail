import { cn } from '@/lib/cn';
import { CheckIcon } from './check-icon';
import { XIcon } from './x-icon';
import { PlusGridIcon } from './plus-grid-icon';

type RunResultStatus = 'pass' | 'fail' | 'running';

export function RunResultIcon({ status, className }: { status: RunResultStatus; className?: string }) {
  const iconClass = cn('w-[16px] h-[16px]', className);

  switch (status) {
    case 'pass':
      return <CheckIcon strokeWidth={2.5} className={cn(iconClass, 'text-[#3ddc97]')} />;
    case 'fail':
      return <XIcon strokeWidth={2.5} className={cn(iconClass, 'text-[#fb7185]')} />;
    default:
      return <PlusGridIcon strokeWidth={2.5} className={cn(iconClass, 'text-[#818cf8]')} />;
  }
}
