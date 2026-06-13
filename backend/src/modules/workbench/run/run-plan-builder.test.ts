import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRunPlan } from './run-plan-builder.js';
import type { UiBrowserRunPlan } from '../validation/workbench-validators.js';

const scenarioText = `
Feature: Checkout
  Scenario: Apply coupon at checkout
    Given the user opens /checkout
    When the user clicks Apply coupon
    Then Coupon applied is visible
`;

test('buildRunPlan uses model plan when provided', async () => {
  const modelPlan: UiBrowserRunPlan = {
    scenarioTitle: 'Apply coupon at checkout',
    actions: [
      { kind: 'open', path: '/checkout' },
      { kind: 'screenshot', label: 'Checkout loaded' },
      { kind: 'click', role: 'button', name: 'Apply coupon' },
      { kind: 'assertText', text: 'Coupon applied' },
    ],
  };
  const result = await buildRunPlan({ scenarioText, modelPlan, defaultRoute: '/checkout' });
  assert.equal(result.actions[0]?.kind, 'open');
  assert.equal(result.actions[0]?.path, '/checkout');
});

test('buildRunPlan falls back to parser when model plan missing', async () => {
  const result = await buildRunPlan({ scenarioText, modelPlan: null, defaultRoute: '/checkout' });
  assert.ok(result.actions.some(action => action.kind === 'open' && action.path === '/checkout'));
  assert.ok(result.actions.some(action => action.kind === 'assertText'));
});
