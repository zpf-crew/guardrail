import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scenarioTextFromChange,
  scenarioTextFromGeneration,
  splitScenarioTexts,
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

test('splitScenarioTexts keeps feature header and separates scenario blocks', () => {
  const scenarios = splitScenarioTexts([
    'Feature: Search',
    '  Scenario: Header search',
    '    Given the homepage is loaded',
    '    When I search for headphone',
    '    Then results are shown',
    '',
    '  Scenario: Footer search',
    '    Given the homepage is loaded',
    '    When I search from footer',
    '    Then results are shown',
  ].join('\n'));

  assert.equal(scenarios.length, 2);
  assert.match(scenarios[0] ?? '', /Feature: Search/);
  assert.match(scenarios[0] ?? '', /Scenario: Header search/);
  assert.doesNotMatch(scenarios[0] ?? '', /Footer search/);
  assert.match(scenarios[1] ?? '', /Feature: Search/);
  assert.match(scenarios[1] ?? '', /Scenario: Footer search/);
  assert.doesNotMatch(scenarios[1] ?? '', /Header search/);
});
