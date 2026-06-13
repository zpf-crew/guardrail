import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scenarioTextFromChange,
  scenarioTextFromGeneration,
  fallbackRunPlanFromScenario,
  parseScenarioRunPlan,
} from './ui-browser-scenario.js';
import type { GeneratedChange, GenerationResult } from '../../workbench.types.js';

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

test('scenarioTextFromChange extracts diff lines from a single change', () => {
  const change: GeneratedChange = {
    id: 'ui-browser-checkout',
    action: 'Add',
    testType: 'UI / Browser',
    title: 'Apply coupon',
    file: 'guardrail-tests/ui/checkout.feature',
    feature: 'Checkout',
    risk: 'High',
    reason: 'Needed coverage.',
    status: 'staged',
    diff: [
      { kind: 'add', text: 'Feature: Checkout' },
      { kind: 'add', text: '  Scenario: Apply coupon at checkout' },
      { kind: 'context', text: '    Given the user opens /checkout' },
    ],
  };

  assert.match(scenarioTextFromChange(change), /Scenario: Apply coupon at checkout/);
  assert.match(scenarioTextFromChange(change), /opens \/checkout/);
});

test('fallback run plan is derived from scenario text and includes multiple screenshots', () => {
  const plan = fallbackRunPlanFromScenario('Scenario: Complete onboarding\nWhen the user continues\nThen scan progress is visible');

  assert.equal(plan.actions.filter(action => action.kind === 'screenshot').length >= 2, true);
  assert.equal(plan.actions[0]?.kind, 'open');
});

test('parseScenarioRunPlan builds route-aware checkout plan from Gherkin text', () => {
  const scenarioText = `
Feature: Checkout
  Scenario: Apply coupon at checkout
    Given the user opens /checkout
    When the user clicks Apply coupon
    Then Coupon applied is visible
`;

  const plan = parseScenarioRunPlan(scenarioText, '/checkout');

  assert.equal(plan.scenarioTitle, 'Apply coupon at checkout');
  assert.equal(plan.actions[0]?.kind, 'open');
  assert.equal(plan.actions[0]?.path, '/checkout');
  assert.ok(plan.actions.some(action => action.kind === 'click' && action.name === 'Apply coupon'));
  assert.ok(plan.actions.some(action => action.kind === 'assertText' && action.text === 'Coupon applied'));
  assert.ok(plan.actions.filter(action => action.kind === 'screenshot').length >= 2);
});
