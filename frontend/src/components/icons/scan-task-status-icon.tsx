import { cn } from '@/lib/cn';
import { LoaderIcon } from './loader-icon';
import { CheckIcon } from './check-icon';
import { WarningTriangleIcon } from './warning-triangle-icon';
import { CircleIcon } from './circle-icon';

type ScanTaskStatus = 'running' | 'done' | 'warn' | 'pending';

export function ScanTaskStatusIcon({ status, className }: { status: ScanTaskStatus; className?: string }) {
  const iconClass = cn('w-[13px] h-[13px]', className);

  switch (status) {
    case 'running':
      return <LoaderIcon strokeWidth={2.4} className={cn(iconClass, 'animate-spin')} />;
    case 'done':
      return <CheckIcon strokeWidth={2.6} className={iconClass} />;
    case 'warn':
      return <WarningTriangleIcon strokeWidth={2.4} className={iconClass} />;
    default:
      return <CircleIcon strokeWidth={2.2} className={iconClass} />;
  }
}
