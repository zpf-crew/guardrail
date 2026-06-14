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
  completedSteps: [],
  thenVerdicts: [],
  pageSnapshot: '- button "Shop Now" @e3',
  actionHistory: [],
  constraints: { behavior: 'Shop now', maxDurationMs: 60_000, maxSteps: 15 },
  elapsedMs: 1000,
  iterationsUsed: 1,
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
  assert.deepEqual(result, { kind: 'click', ref: '@e2' });
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
  assert.deepEqual(result, { kind: 'click', ref: '@e4' });
});
