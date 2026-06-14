import type { Evidence } from '../../workbench.types.js';

export function screenshotEvidence(label: string, href?: string): Evidence {
  return { kind: 'screenshot', label, href };
}

export function screenshotPathFromStdout(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  const savedMatch = trimmed.match(/Screenshot saved to\s+(.+)$/i);
  const value = savedMatch?.[1]?.trim() ?? trimmed;
  return value.length > 0 ? value : undefined;
}

export function traceEvidence(label: string, href?: string): Evidence {
  return { kind: 'trace', label, href };
}
