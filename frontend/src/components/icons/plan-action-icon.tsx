import { cn } from '@/lib/cn';
import { PlusIcon } from './plus-icon';
import { EditIcon } from './edit-icon';
import { TrashIcon } from './trash-icon';
import { ClockIcon } from './clock-icon';

type PlanActionVariant = 'add' | 'update' | 'delete' | 'run';

function resolveVariant(action: string): PlanActionVariant {
  if (action.includes('Add')) return 'add';
  if (action.includes('Update')) return 'update';
  if (action.includes('Delete')) return 'delete';
  return 'run';
}

export function PlanActionIcon({ action, className }: { action: string; className?: string }) {
  const variant = resolveVariant(action);
  const iconClass = cn('w-[16px] h-[16px]', className);

  switch (variant) {
    case 'add':
      return <PlusIcon className={iconClass} />;
    case 'update':
      return <EditIcon className={iconClass} />;
    case 'delete':
      return <TrashIcon className={iconClass} />;
    default:
      return <ClockIcon className={iconClass} />;
  }
}
