/** Shared presentation for scan-log tags, used by the onboarding scan feed and the dashboard re-scan overlay. */

export function logTagClass(tag: string): string {
  if (tag === 'ok') return 'text-[#3ddc97]';
  if (tag === 'warn') return 'text-[#fbbf24]';
  return 'text-[#22d3ee]';
}

export function logTagSymbol(tag: string): string {
  return tag === 'ok' ? '✓' : tag === 'warn' ? '!' : '›';
}
