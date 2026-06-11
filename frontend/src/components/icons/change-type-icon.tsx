import { cn } from '@/lib/cn';
import { PlusIcon } from './plus-icon';
import { EditIcon } from './edit-icon';
import { TrashIcon } from './trash-icon';

type ChangeType = 'add' | 'update' | 'delete';

export function ChangeTypeIcon({ changeType, className }: { changeType: ChangeType; className?: string }) {
  const iconClass = cn('w-[16px] h-[16px]', className);

  switch (changeType) {
    case 'add':
      return <PlusIcon className={iconClass} />;
    case 'update':
      return <EditIcon className={iconClass} />;
    case 'delete':
      return <TrashIcon className={iconClass} />;
  }
}
