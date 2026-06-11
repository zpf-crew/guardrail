import { cn } from '@/lib/cn';
import { TestStatusPassIcon } from './test-status-pass-icon';
import { TestStatusFailIcon } from './test-status-fail-icon';
import { TestStatusFlakyIcon } from './test-status-flaky-icon';
import { TestStatusMissingIcon } from './test-status-missing-icon';
import { TestStatusSuspectIcon } from './test-status-suspect-icon';

const statusColor: Record<string, string> = {
  pass: '#3ddc97',
  fail: '#fb7185',
  flaky: '#fbbf24',
  missing: '#60a5fa',
  suspect: '#c084fc',
};

const statusIcons = {
  pass: TestStatusPassIcon,
  fail: TestStatusFailIcon,
  flaky: TestStatusFlakyIcon,
  missing: TestStatusMissingIcon,
  suspect: TestStatusSuspectIcon,
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
