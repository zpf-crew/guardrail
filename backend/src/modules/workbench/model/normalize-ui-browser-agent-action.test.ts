import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgentActionInput } from './normalize-ui-browser-agent-action.js';
import type { AgentIterationContext } from '../adapters/ui-browser/ui-browser-agent-context.js';

const context: AgentIterationContext = {
  scenarioTitle: 'Shop now',
  gherkinSteps: [
    { index: 0, kind: 'Given', effectiveKind: 'Given', text: 'the user is on the home page' },
    { index: 1, kind: 'When', effectiveKind: 'When', text: 'the user clicks Shop Now' },
    { index: 2, kind: 'Then', effectiveKind: 'Then', text: 'the products page is displayed' },
  ],
  currentStepIndex: 0,
  currentStep: {
    index: 0,
    kind: 'Given',
    effectiveKind: 'Given',
    text: 'the user is on the home page',
    observationOnlyActionsUsed: 0,
    observationOnlyActionsRemaining: 6,
    verdictRequiredNow: false,
  },
  completedSteps: [],
  thenVerdicts: [],
  pageSnapshot: '- button "Shop Now" @e3',
  actionHistory: [],
  constraints: { behavior: 'Shop now', maxStepDurationMs: 20_000, maxSteps: 15 },
  elapsedMs: 1000,
  iterationsUsed: 1,
  allowedActionKinds: ['agentBrowserCommand', 'stepComplete', 'stepFailed'],
  allowedCommands: ['open', 'snapshot', 'click', 'find', 'fill', 'press', 'scroll', 'scrollintoview', 'get', 'is', 'wait'],
};

test('normalizeAgentActionInput fills missing stepComplete fields from context', () => {
  const result = normalizeAgentActionInput({ kind: 'stepComplete' }, context);
  assert.deepEqual(result, {
    kind: 'stepComplete',
    stepIndex: 0,
    note: 'Completed: the user is on the home page',
  });
});

test('normalizeAgentActionInput unwraps nested action objects', () => {
  const result = normalizeAgentActionInput({
    action: { kind: 'click', ref: '@e2' },
  }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'click',
    args: ['@e2'],
    reason: 'Click @e2',
  });
});

test('normalizeAgentActionInput coerces snake_case step_index', () => {
  const result = normalizeAgentActionInput({
    kind: 'stepComplete',
    step_index: 1,
    note: 'Clicked Shop Now',
  }, context);
  assert.deepEqual(result, {
    kind: 'stepComplete',
    stepIndex: 1,
    note: 'Clicked Shop Now',
  });
});

test('normalizeAgentActionInput adds @ prefix to bare element refs', () => {
  const result = normalizeAgentActionInput({ kind: 'click', ref: 'e4' }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'click',
    args: ['@e4'],
    reason: 'Click @e4',
  });
});

test('normalizeAgentActionInput defaults blank press key to Enter', () => {
  const result = normalizeAgentActionInput({ kind: 'press', key: ' ' }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'press',
    args: ['Enter'],
    reason: 'Press keyboard key',
  });
});

test('normalizeAgentActionInput defaults invalid scroll direction to down', () => {
  const result = normalizeAgentActionInput({ kind: 'scroll', direction: 'bottom', pixels: 499.6 }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'scroll',
    args: ['down', '500'],
    reason: 'Scroll page',
  });
});

test('normalizeAgentActionInput preserves agentBrowserCommand args as strings', () => {
  const result = normalizeAgentActionInput({
    kind: 'agent_browser_command',
    command: 'scroll',
    args: ['down', 500],
    reason: 'Reveal product card buttons',
  }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'scroll',
    args: ['down', '500'],
    reason: 'Reveal product card buttons',
  });
});

test('normalizeAgentActionInput converts legacy click action into command envelope', () => {
  const result = normalizeAgentActionInput({ kind: 'click', ref: 'e4' }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'click',
    args: ['@e4'],
    reason: 'Click @e4',
  });
});

test('normalizeAgentActionInput converts legacy screenshot action into command envelope', () => {
  const result = normalizeAgentActionInput({ kind: 'screenshot', label: 'Home loaded' }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'screenshot',
    args: [],
    reason: 'Home loaded',
  });
});

test('normalizeAgentActionInput converts legacy wait action to load flag syntax', () => {
  const result = normalizeAgentActionInput({ kind: 'wait', load: 'networkidle' }, context);
  assert.deepEqual(result, {
    kind: 'agentBrowserCommand',
    command: 'wait',
    args: ['--load', 'networkidle'],
    reason: 'Wait for page readiness',
  });
});
