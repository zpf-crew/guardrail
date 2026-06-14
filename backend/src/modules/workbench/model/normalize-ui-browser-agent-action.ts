import type { AgentIterationContext } from '../adapters/ui-browser/ui-browser-agent-context.js';

const KIND_ALIASES: Record<string, string> = {
  agent_browser_command: 'agentBrowserCommand',
  agent_browser: 'agentBrowserCommand',
  command: 'agentBrowserCommand',
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

function stringArgs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(value => String(value));
}

function commandReason(action: Record<string, unknown>, fallback: string): string {
  return typeof action.reason === 'string' && action.reason.trim()
    ? action.reason.trim()
    : fallback;
}

function legacyCommand(kind: string, normalized: Record<string, unknown>, context: AgentIterationContext): unknown {
  switch (kind) {
    case 'open':
      return {
        kind: 'agentBrowserCommand',
        command: 'open',
        args: [typeof normalized.path === 'string' && normalized.path.trim() ? normalized.path.trim() : '/'],
        reason: commandReason(normalized, `Open page for ${context.gherkinSteps[context.currentStepIndex]?.text ?? context.scenarioTitle}`),
      };
    case 'wait':
      return {
        kind: 'agentBrowserCommand',
        command: 'wait',
        args: [normalized.load === 'domcontentloaded' ? 'domcontentloaded' : 'networkidle'],
        reason: commandReason(normalized, 'Wait for page readiness'),
      };
    case 'click': {
      const ref = normalizeRef(normalized.ref);
      return ref ? {
        kind: 'agentBrowserCommand',
        command: 'click',
        args: [ref],
        reason: commandReason(normalized, `Click ${ref}`),
      } : normalized;
    }
    case 'fill': {
      const ref = normalizeRef(normalized.ref);
      return ref ? {
        kind: 'agentBrowserCommand',
        command: 'fill',
        args: [ref, typeof normalized.value === 'string' ? normalized.value : ''],
        reason: commandReason(normalized, `Fill ${ref}`),
      } : normalized;
    }
    case 'press':
      return {
        kind: 'agentBrowserCommand',
        command: 'press',
        args: [typeof normalized.key === 'string' && normalized.key.trim() ? normalized.key.trim() : 'Enter'],
        reason: commandReason(normalized, 'Press keyboard key'),
      };
    case 'scroll':
      return {
        kind: 'agentBrowserCommand',
        command: 'scroll',
        args: [
          isScrollDirection(normalized.direction) ? normalized.direction : 'down',
          ...(typeof normalized.pixels === 'number' && Number.isFinite(normalized.pixels) && normalized.pixels > 0
            ? [String(Math.round(normalized.pixels))]
            : []),
        ],
        reason: commandReason(normalized, 'Scroll page'),
      };
    case 'screenshot':
      return {
        kind: 'agentBrowserCommand',
        command: 'screenshot',
        args: [],
        reason: typeof normalized.label === 'string' && normalized.label.trim()
          ? normalized.label.trim()
          : stepText(context, context.currentStepIndex),
      };
    default:
      return normalized;
  }
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
    case 'agentBrowserCommand':
      return {
        kind,
        command: typeof normalized.command === 'string' ? normalized.command.trim() : '',
        args: stringArgs(normalized.args),
        reason: commandReason(normalized, stepText(context, stepIndex)),
      };
    case 'open':
    case 'wait':
    case 'click':
    case 'fill':
    case 'press':
    case 'scroll':
    case 'screenshot':
      return legacyCommand(kind, normalized, context);
    default:
      return normalized;
  }
}

function isScrollDirection(value: unknown): value is 'up' | 'down' | 'left' | 'right' {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}
