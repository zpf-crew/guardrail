import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeneratedChange } from '../../workbench.types.js';
import {
  buildDroppedScenarioRows,
  buildExecutionPlanTraceEvidence,
  indexedScenariosFromChange,
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
