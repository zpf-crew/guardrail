export type GherkinStepKind = 'Given' | 'When' | 'Then' | 'And' | 'But';
export type GherkinEffectiveKind = 'Given' | 'When' | 'Then';

export interface GherkinStep {
  index: number;
  kind: GherkinStepKind;
  effectiveKind: GherkinEffectiveKind;
  text: string;
}

const STEP_RE = /^\s*(Given|When|Then|And|But)\s+(.+)$/i;

export function parseGherkinSteps(scenarioText: string): GherkinStep[] {
  const steps: GherkinStep[] = [];
  let currentEffective: GherkinEffectiveKind = 'Given';

  for (const line of scenarioText.split('\n')) {
    const match = line.match(STEP_RE);
    if (!match) continue;

    const kind = capitalizeKind(match[1]!);
    const text = match[2]!.trim();
    if (kind === 'Given' || kind === 'When' || kind === 'Then') {
      currentEffective = kind;
    }

    steps.push({
      index: steps.length,
      kind,
      effectiveKind: currentEffective,
      text,
    });
  }

  return steps;
}

export function scenarioTitleFromGherkin(scenarioText: string): string {
  const match = scenarioText.match(/Scenario:\s*(.+)/i);
  return match?.[1]?.trim() || 'Generated UI Browser scenario';
}

function capitalizeKind(raw: string): GherkinStepKind {
  const lower = raw.toLowerCase();
  if (lower === 'given') return 'Given';
  if (lower === 'when') return 'When';
  if (lower === 'then') return 'Then';
  if (lower === 'and') return 'And';
  return 'But';
}
