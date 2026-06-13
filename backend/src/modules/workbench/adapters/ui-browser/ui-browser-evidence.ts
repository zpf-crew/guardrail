import type { Evidence } from '../../workbench.types.js';

export function screenshotEvidence(label: string, href?: string): Evidence {
  return { kind: 'screenshot', label, href };
}

export function traceEvidence(label: string, href?: string): Evidence {
  return { kind: 'trace', label, href };
}
