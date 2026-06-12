import type { TestStatus, RiskLevel, Severity } from '@/types/testlens';

/**
 * Centralized enum → color/label maps for the dashboard, keyed to the CONTRACT
 * enums (`passed`/`High`/`suspicious`, not the old `pass`/`high`/`suspect`).
 * Defining these once avoids the silent-break risk of inline maps scattered
 * across the page that key on stale enum strings.
 */

export interface StatusView {
  /** Chip / badge background. */
  bg: string;
  /** Text + dot color. */
  color: string;
}

/** Background + foreground per test status (chips, status pills, icon tiles). */
export const TEST_STATUS_VIEW: Record<TestStatus, StatusView> = {
  passed: { bg: 'var(--pass-bg)', color: 'var(--pass)' },
  failed: { bg: 'var(--fail-bg)', color: 'var(--fail)' },
  flaky: { bg: 'var(--flaky-bg)', color: 'var(--flaky)' },
  missing: { bg: 'var(--missing-bg)', color: 'var(--missing)' },
  suspicious: { bg: 'var(--suspect-bg)', color: 'var(--suspect)' },
};

/** Solid hex per status — for sparkbars where a literal color reads cleaner. */
export const TEST_STATUS_COLOR: Record<TestStatus, string> = {
  passed: '#3ddc97',
  failed: '#fb7185',
  flaky: '#fbbf24',
  missing: '#60a5fa',
  suspicious: '#c084fc',
};

/** Text color per risk level (Critical shares red with High). */
export const RISK_COLOR: Record<RiskLevel, string> = {
  Low: 'var(--pass)',
  Medium: 'var(--flaky)',
  High: 'var(--fail)',
  Critical: 'var(--fail)',
};

/** Background + foreground per insight severity. */
export const SEVERITY_VIEW: Record<Severity, StatusView> = {
  Critical: { bg: 'rgba(251,113,133,0.16)', color: 'var(--fail)' },
  High: { bg: 'rgba(251,191,36,0.14)', color: 'var(--flaky)' },
  Medium: { bg: 'rgba(96,165,250,0.14)', color: 'var(--missing)' },
  Low: { bg: 'rgba(139,148,167,0.16)', color: 'var(--gray)' },
};

/** Chip dot color for a Testing-Structure count kind. */
export const STRUCTURE_KIND_COLOR: Record<string, string> = {
  unit: 'var(--pass)',
  integration: 'var(--missing)',
  failed: 'var(--fail)',
  flaky: 'var(--flaky)',
  missing: 'var(--missing)',
  suspicious: 'var(--suspect)',
  other: 'var(--suspect)',
};
