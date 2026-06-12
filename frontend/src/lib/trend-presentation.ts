import type { Trend } from '@/types/testlens';

/**
 * Maps a contract `Trend` to its visual presentation.
 *
 * Color is driven by `sentiment` (semantic), NOT by the sign of `value` —
 * e.g. "failed −3" is a *good* movement even though the number went down.
 * The sign of `value` only chooses the arrow direction.
 */
export interface TrendView {
  /** CSS color (token value) for the delta text. */
  color: string;
  /** Arrow direction derived from the numeric sign. */
  arrow: 'up' | 'down' | 'flat';
  /** Display label, e.g. "+5 vs last scan". */
  text: string;
}

const SENTIMENT_COLOR: Record<Trend['sentiment'], string> = {
  good: 'var(--pass)',
  bad: 'var(--fail)',
  neutral: 'var(--dim)',
};

export function trendPresentation(trend?: Trend): TrendView | null {
  if (!trend) return null;

  const arrow: TrendView['arrow'] = trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat';
  const sign = trend.value > 0 ? '+' : ''; // negatives already carry '-'
  const basis = trend.basis ? ` ${trend.basis}` : '';

  return {
    color: SENTIMENT_COLOR[trend.sentiment],
    arrow,
    text: `${sign}${trend.value}${basis}`,
  };
}
