import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeneratedChange } from '../../workbench.types.js';
import type { UiBrowserAcceptedFlow, UiBrowserExecutionPlan } from '../../validation/workbench-validators.js';
import {
  buildDroppedScenarioRows,
  buildExecutionPlanTraceEvidence,
  indexedScenariosFromChange,
  sanitizeExecutionPlan,
  validateFlowSourceScenarios,
} from './ui-browser-flow-plan.js';

const change: GeneratedChange = {
  id: 'change-1',
  action: 'Add',
  testType: 'UI / Browser',
  title: 'Add product to cart from homepage',
  file: 'guardrail-tests/ui/cart.feature',
  feature: 'Cart',
  risk: 'High',
  reason: 'Missing durable cart coverage',
  status: 'staged',
  diff: [
    { kind: 'add', text: 'Feature: Cart' },
    { kind: 'add', text: 'Scenario: Add one product' },
    { kind: 'add', text: '  Given the homepage is loaded' },
    { kind: 'add', text: '  When I click "Add to Cart"' },
    { kind: 'add', text: '  Then the cart should contain 1 item' },
    { kind: 'add', text: 'Scenario: Toast appears' },
    { kind: 'add', text: '  Given the homepage is loaded' },
    { kind: 'add', text: '  When I click "Add to Cart"' },
    { kind: 'add', text: '  Then I should see a success toast' },
  ],
};

test('indexes scenarios from a generated change', () => {
  const scenarios = indexedScenariosFromChange(change);

  assert.equal(scenarios.length, 2);
  assert.equal(scenarios[0].index, 0);
  assert.equal(scenarios[0].title, 'Add one product');
  assert.match(scenarios[1].text, /success toast/);
});

test('builds skipped rows for dropped scenarios', () => {
  const scenarios = indexedScenariosFromChange(change);
  const rows = buildDroppedScenarioRows(change, scenarios, [
    { sourceScenarioIndex: 1, reason: 'Toast-only assertion is transient.' },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'Skipped');
  assert.equal(rows[0].title, 'Toast appears');
  assert.equal(rows[0].reason, 'Dropped before execution: Toast-only assertion is transient.');
});

test('builds trace evidence for flow and execution plans', async () => {
  const evidence = await buildExecutionPlanTraceEvidence({
    flowPlan: { behaviorTitle: 'Cart', acceptedFlows: [], droppedScenarios: [] },
    executionPlans: [],
  });

  assert.equal(evidence?.kind, 'trace');
  assert.equal(evidence?.label, 'UI Browser flow plan trace');
});

test('rejects accepted flows that cite missing source scenarios', () => {
  const scenarios = indexedScenariosFromChange(change);

  assert.throws(
    () => validateFlowSourceScenarios(
      { id: 'flow-1', title: 'Bad flow', sourceScenarioIndexes: [99] },
      scenarios,
    ),
    /unknown source scenario index 99/,
  );
});

test('sanitizeExecutionPlan rewrites transient action success criteria', () => {
  const plan: UiBrowserExecutionPlan = {
    flowId: 'flow-1',
    title: 'Add product to cart',
    steps: [
      { id: 'step-1', kind: 'setup', instruction: 'Open the homepage.', successCriteria: 'The homepage is loaded.' },
      { id: 'step-2', kind: 'action', instruction: 'Click Add to Cart.', successCriteria: 'A success toast notification appears.' },
      { id: 'step-3', kind: 'assert', instruction: 'Verify cart count.', successCriteria: 'The cart count shows one item.' },
    ],
  };

  const sanitized = sanitizeExecutionPlan(plan);

  assert.equal(sanitized.steps[1]?.successCriteria, 'The action completes and the durable page state can be checked in the next assertion.');
});

test('sanitizeExecutionPlan rewrites transient action instructions with durable success criteria', () => {
  const plan: UiBrowserExecutionPlan = {
    flowId: 'flow-1',
    title: 'Add product to cart',
    steps: [
      { id: 'step-1', kind: 'setup', instruction: 'Open the homepage.', successCriteria: 'The homepage is loaded.' },
      { id: 'step-2', kind: 'action', instruction: 'Click Add to Cart and wait for the toast.', successCriteria: 'The cart state is ready to verify.' },
      { id: 'step-3', kind: 'assert', instruction: 'Verify cart count.', successCriteria: 'The cart count shows one item.' },
    ],
  };

  const sanitized = sanitizeExecutionPlan(plan);

  assert.doesNotMatch(sanitized.steps[1]?.instruction ?? '', /toast/i);
  assert.equal(sanitized.steps[1]?.instruction, 'Perform the requested user action and continue to the durable assertion.');
  assert.equal(sanitized.steps[1]?.successCriteria, 'The cart state is ready to verify.');
});

test('sanitizeExecutionPlan rewrites transient assert criteria in durable flows', () => {
  const plan: UiBrowserExecutionPlan = {
    flowId: 'flow-1',
    title: 'Add product to cart',
    steps: [
      { id: 'step-1', kind: 'setup', instruction: 'Open the homepage.', successCriteria: 'The homepage is loaded.' },
      { id: 'step-2', kind: 'action', instruction: 'Click Add to Cart.', successCriteria: 'The action completes.' },
      { id: 'step-3', kind: 'assert', instruction: 'Verify cart feedback.', successCriteria: 'A success toast notification appears.' },
    ],
  };
  const flow: Pick<UiBrowserAcceptedFlow, 'userGoal' | 'durableOutcome' | 'title'> = {
    title: 'Add product to cart',
    userGoal: 'A shopper adds a product to cart.',
    durableOutcome: 'The cart count shows one item.',
  };

  const sanitized = sanitizeExecutionPlan(plan, flow);

  assert.equal(sanitized.steps[2]?.instruction, 'Verify that the cart count shows one item.');
  assert.equal(sanitized.steps[2]?.successCriteria, 'The cart count shows one item.');
});

test('sanitizeExecutionPlan does not trust generated plan title for transient bypass', () => {
  const plan: UiBrowserExecutionPlan = {
    flowId: 'flow-1',
    title: 'Toast appears',
    steps: [
      { id: 'step-1', kind: 'setup', instruction: 'Open the homepage.', successCriteria: 'The homepage is loaded.' },
      { id: 'step-2', kind: 'action', instruction: 'Click Add to Cart.', successCriteria: 'The action completes.' },
      { id: 'step-3', kind: 'assert', instruction: 'Verify toast.', successCriteria: 'A success toast notification appears.' },
    ],
  };

  const sanitized = sanitizeExecutionPlan(plan, {
    title: 'Add product to cart',
    userGoal: 'Add a product to the cart',
    durableOutcome: 'The cart count shows one item.',
  });

  assert.equal(sanitized.steps[2]?.successCriteria, 'The cart count shows one item.');
});

test('sanitizeExecutionPlan does not treat durable notification settings flows as explicit transient flows', () => {
  const plan: UiBrowserExecutionPlan = {
    flowId: 'flow-1',
    title: 'Update notification settings',
    steps: [
      { id: 'step-1', kind: 'setup', instruction: 'Open notification settings.', successCriteria: 'Settings page is loaded.' },
      { id: 'step-2', kind: 'action', instruction: 'Enable email notifications.', successCriteria: 'A toast notification appears.' },
      { id: 'step-3', kind: 'assert', instruction: 'Verify notification settings.', successCriteria: 'A toast notification confirms the save.' },
    ],
  };
  const flow: Pick<UiBrowserAcceptedFlow, 'userGoal' | 'durableOutcome' | 'title'> = {
    title: 'Update notification settings',
    userGoal: 'A user updates notification settings.',
    durableOutcome: 'Email notification settings remain enabled after saving.',
  };

  const sanitized = sanitizeExecutionPlan(plan, flow);

  assert.equal(sanitized.steps[1]?.successCriteria, 'The action completes and the durable page state can be checked in the next assertion.');
  assert.equal(sanitized.steps[2]?.instruction, 'Verify that email notification settings remain enabled after saving.');
  assert.equal(sanitized.steps[2]?.successCriteria, 'Email notification settings remain enabled after saving.');
});

test('sanitizeExecutionPlan keeps explicit toast flows intact', () => {
  const plan: UiBrowserExecutionPlan = {
    flowId: 'flow-1',
    title: 'Toast can be dismissed',
    steps: [
      { id: 'step-1', kind: 'setup', instruction: 'Open the homepage.', successCriteria: 'The homepage is loaded.' },
      { id: 'step-2', kind: 'action', instruction: 'Add a product so the toast appears.', successCriteria: 'The toast appears.' },
      { id: 'step-3', kind: 'assert', instruction: 'Verify the toast is dismissible.', successCriteria: 'The toast can be dismissed.' },
    ],
  };

  const sanitized = sanitizeExecutionPlan(plan);

  assert.equal(sanitized.steps[1]?.successCriteria, 'The toast appears.');
  assert.equal(sanitized.steps[2]?.successCriteria, 'The toast can be dismissed.');
});
