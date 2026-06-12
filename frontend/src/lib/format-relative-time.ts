/**
 * Formats an ISO-8601 UTC timestamp as a short relative string ("4 min ago").
 *
 * The contract sends raw ISO timestamps; the UI owns all "time ago" formatting.
 * `null` means the test never ran (e.g. status === 'missing').
 *
 * @param iso  ISO-8601 string, or null for "never run".
 * @param now  Reference point — injectable so this stays pure & testable.
 */
export function formatRelativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'never run';

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const diffMs = now.getTime() - then;
  const sec = Math.round(diffMs / 1000);

  if (sec < 0) return 'just now'; // clock skew / future timestamp
  if (sec < 45) return 'just now';

  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;

  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;

  const days = Math.round(hr / 24);
  if (days <= 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  // Older than a week — fall back to a calendar date (local time).
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
