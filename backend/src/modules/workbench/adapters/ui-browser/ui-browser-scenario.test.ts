import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarioTextFromGeneration, fallbackRunPlanFromScenario } from './ui-browser-scenario.js';
import type { GenerationResult } from '../../workbench.types.js';

test('extracts scenario text from generated diff', () => {
  const generation: GenerationResult = {
    timeline: [],
    changes: [{
      id: 'ui-browser-onboarding',
      action: 'Add',
      testType: 'UI / Browser',
      title: 'Complete onboarding',
      file: 'guardrail-tests/ui/onboarding.feature',
      feature: 'Onboarding',
      risk: 'High',
      reason: 'Needed coverage.',
      status: 'staged',
      diff: [
        { kind: 'add', text: 'Feature: Guardrail onboarding' },
        { kind: 'add', text: '  Scenario: Complete onboarding' },
        { kind: 'add', text: '    Given the user opens Guardrail onboarding' },
      ],
    }],
    beforeAfter: { before: [], after: [] },
  };

  assert.match(scenarioTextFromGeneration(generation), /Scenario: Complete onboarding/);
});

test('fallback run plan is derived from scenario text and includes multiple screenshots', () => {
  const plan = fallbackRunPlanFromScenario('Scenario: Complete onboarding\nWhen the user continues\nThen scan progress is visible');

  assert.equal(plan.actions.filter(action => action.kind === 'screenshot').length >= 2, true);
  assert.equal(plan.actions[0]?.kind, 'open');
});
