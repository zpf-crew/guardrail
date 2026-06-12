import { cn } from '@/lib/cn';
import { TestStatusPassIcon } from './test-status-pass-icon';
import { TestStatusFailIcon } from './test-status-fail-icon';
import { TestStatusFlakyIcon } from './test-status-flaky-icon';
import { TestStatusMissingIcon } from './test-status-missing-icon';
import { TestStatusSuspectIcon } from './test-status-suspect-icon';

// Keyed to the contract TestStatus enum (`passed`/`failed`/`suspicious`).
const statusColor: Record<string, string> = {
  passed: '#3ddc97',
  failed: '#fb7185',
  flaky: '#fbbf24',
  missing: '#60a5fa',
  suspicious: '#c084fc',
};

const statusIcons = {
  passed: TestStatusPassIcon,
  failed: TestStatusFailIcon,
  flaky: TestStatusFlakyIcon,
  missing: TestStatusMissingIcon,
  suspicious: TestStatusSuspectIcon,
} as const;

export function TestStatusIcon({ status, className }: { status: string; className?: string }) {
  const Icon = statusIcons[status as keyof typeof statusIcons] ?? TestStatusMissingIcon;
  return (
    <Icon
      stroke={statusColor[status] ?? statusColor.missing}
      strokeWidth={2.2}
      className={cn('w-[15px] h-[15px]', className)}
    />
  );
}
