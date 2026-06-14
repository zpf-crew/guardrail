import type { AgentIterationContext } from '../adapters/ui-browser/ui-browser-agent-context.js';

const KIND_ALIASES: Record<string, string> = {
  step_complete: 'stepComplete',
  step_failed: 'stepFailed',
  assert_then: 'assertThen',
  scenario_complete: 'scenarioComplete',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function unwrapAction(value: unknown): Record<string, unknown> | null {
  const root = asRecord(value);
  if (!root) return null;

  const nested = asRecord(root.action)
    ?? asRecord(root.UiBrowserAgentAction)
    ?? asRecord(root.uiBrowserAgentAction);
  if (nested) return nested;

  return root;
}

function normalizeKind(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return KIND_ALIASES[trimmed] ?? trimmed;
}

function coerceFieldNames(action: Record<string, unknown>): Record<string, unknown> {
  const aliases: Record<string, string> = {
    step_index: 'stepIndex',
    screenshot_label: 'label',
  };

  const result: Record<string, unknown> = { ...action };
  for (const [from, to] of Object.entries(aliases)) {
    if (result[to] == null && result[from] != null) {
      result[to] = result[from];
    }
  }
  return result;
}

function stepText(context: AgentIterationContext, stepIndex: number): string {
  return context.gherkinSteps[stepIndex]?.text ?? `step ${stepIndex}`;
}

function normalizeRef(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (/^@e\d+$/i.test(trimmed)) return trimmed.toLowerCase().replace(/^@e/, '@e');
  if (/^e\d+$/i.test(trimmed)) return `@${trimmed.toLowerCase().replace(/^e/, 'e')}`;
  return trimmed;
}

export function normalizeAgentActionInput(
  value: unknown,
  context: AgentIterationContext,
): unknown {
  const action = unwrapAction(value);
  if (!action) return value;

  const kind = normalizeKind(action.kind);
  if (!kind) return action;

  const normalized = coerceFieldNames({ ...action, kind });
  const stepIndex = typeof normalized.stepIndex === 'number'
    ? normalized.stepIndex
    : context.currentStepIndex;

  switch (kind) {
    case 'stepComplete':
      return {
        kind,
        stepIndex,
        note: typeof normalized.note === 'string' && normalized.note.trim()
          ? normalized.note
          : `Completed: ${stepText(context, stepIndex)}`,
      };
    case 'assertThen':
      return {
        kind,
        stepIndex,
        satisfied: typeof normalized.satisfied === 'boolean' ? normalized.satisfied : false,
        reason: typeof normalized.reason === 'string' && normalized.reason.trim()
          ? normalized.reason
          : 'Model did not provide an assertThen reason.',
      };
    case 'stepFailed':
      return {
        kind,
        stepIndex,
        reason: typeof normalized.reason === 'string' && normalized.reason.trim()
          ? normalized.reason
          : `Failed: ${stepText(context, stepIndex)}`,
      };
    case 'screenshot':
      return {
        kind,
        label: typeof normalized.label === 'string' && normalized.label.trim()
          ? normalized.label
          : stepText(context, stepIndex),
      };
    case 'open':
      return {
        kind,
        path: typeof normalized.path === 'string' && normalized.path.trim()
          ? normalized.path
          : '/',
      };
    case 'wait':
      return {
        kind,
        load: normalized.load === 'domcontentloaded' ? 'domcontentloaded' : 'networkidle',
      };
    case 'click': {
      const ref = normalizeRef(normalized.ref);
      return ref ? { kind, ref } : normalized;
    }
    case 'fill': {
      const ref = normalizeRef(normalized.ref);
      return ref
        ? { kind, ref, value: typeof normalized.value === 'string' ? normalized.value : '' }
        : normalized;
    }
    default:
      return normalized;
  }
}
