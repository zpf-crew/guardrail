/**
 * Formats a 0..100 coverage/percentage number for display.
 * The contract sends numbers (never strings, never 0..1).
 *
 * @param n   Value in 0..100.
 * @param dp  Decimal places (default 1). Trailing ".0" is trimmed.
 */
export function formatPercent(n: number, dp: number = 1): string {
  if (!Number.isFinite(n)) return '—';
  const fixed = n.toFixed(dp);
  // Trim a trailing ".0" / ".00" so whole numbers read as "92%" not "92.0%".
  const trimmed = fixed.replace(/\.0+$/, '');
  return `${trimmed}%`;
}
