import type { RiskLevel, BehaviorClassification, GeneratedChange, RunOutcome } from '@/types/testlens';
import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

/** Risk level → Badge variant (Critical shares red with High). */
export const RISK_BADGE: Record<RiskLevel, BadgeVariant> = {
  Low: 'pass',
  Medium: 'flaky',
  High: 'fail',
  Critical: 'fail',
};

/** Risk level → solid color (progress bars). */
export const RISK_COLOR: Record<RiskLevel, string> = {
  Low: '#3ddc97',
  Medium: '#fbbf24',
  High: '#fb7185',
  Critical: '#fb7185',
};

/** Behavior classification status → Badge variant. */
export const CLASS_STATUS_BADGE: Record<BehaviorClassification['status'], BadgeVariant> = {
  Covered: 'pass',
  Missing: 'missing',
  Weak: 'flaky',
  Failed: 'fail',
  Suspicious: 'suspect',
};

/** Behavior classification status → left-border accent color. */
export const CLASS_BORDER_COLOR: Record<BehaviorClassification['status'], string> = {
  Covered: '#3ddc97',
  Missing: '#60a5fa',
  Weak: '#fbbf24',
  Failed: '#fb7185',
  Suspicious: '#c084fc',
};

/** Generated-change action → { bg, color } chip styling. */
export const CHANGE_ACTION_STYLE: Record<GeneratedChange['action'], { bg: string; color: string }> = {
  Add: { bg: 'rgba(61,220,151,0.13)', color: '#3ddc97' },
  Update: { bg: 'rgba(96,165,250,0.13)', color: '#60a5fa' },
  Delete: { bg: 'rgba(251,113,133,0.14)', color: '#fb7185' },
};

/** Run outcome → { bg, color } pill styling. */
export const RUN_OUTCOME_STYLE: Record<RunOutcome, { bg: string; color: string }> = {
  Passed: { bg: 'rgba(61,220,151,0.13)', color: '#3ddc97' },
  Failed: { bg: 'rgba(251,113,133,0.14)', color: '#fb7185' },
  Flaky: { bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' },
  Skipped: { bg: 'rgba(139,148,167,0.16)', color: '#8b94a7' },
  'Needs approval': { bg: 'rgba(129,140,248,0.14)', color: '#818cf8' },
};
