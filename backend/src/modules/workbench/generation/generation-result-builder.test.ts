import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationResult, resolveGenerationChanges } from './generation-result-builder.js';
import type { IntentInput, IsolationResult, TestPlan } from '../workbench.types.js';

const intent: IntentInput = { prompt: 'UI checkout', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] };
const isolation: IsolationResult = {
  target: { feature: 'Checkout', repo: { name: 'acme', path: '/repo', branch: 'main' } },
  sourceFiles: [], existingTestFiles: [], specDocs: [], qcCases: [],
  currentCoverage: { line: 0, branch: 0 }, currentStatus: { failed: 0, suspicious: 0, missing: 1 },
  userJourneys: [], classifications: [{
    behavior: 'Complete checkout', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'Missing',
  }],
};
const plan: TestPlan = {
  proposedActions: [{ action: 'add', label: 'Add checkout UI test', count: 1 }],
  risk: { productionCodeChanges: 'none', testDataChanges: false, browserAutomationRequired: true, mobileSimulatorRequired: 'no', externalApiMocking: 'optional' },
  filesToChange: ['guardrail-tests/ui/checkout.feature'],
  questions: [],
};

test('buildGenerationResult wraps model changes with timeline and beforeAfter', () => {
  const result = buildGenerationResult(intent, isolation, plan, [{
    id: 'checkout-ui',
    action: 'Add',
    testType: 'UI / Browser',
    title: 'Complete checkout',
    file: 'guardrail-tests/ui/checkout.feature',
    feature: 'Checkout',
    risk: 'High',
    reason: 'Covers missing checkout journey.',
    diff: [{ kind: 'add', text: 'Scenario: Complete checkout' }],
    status: 'staged',
  }]);

  assert.equal(result.changes.length, 1);
  assert.equal(result.timeline.length, 2);
  assert.ok(result.beforeAfter.before[0]?.length > 0);
});

const multiIsolation: IsolationResult = {
  ...isolation,
  classifications: [
    { behavior: 'Apply coupon at checkout', status: 'Missing', suggestedTypes: ['UI / Browser'], risk: 'High', explanation: 'Missing' },
    { behavior: 'Show payment errors', status: 'Weak', suggestedTypes: ['UI / Browser'], risk: 'Medium', explanation: 'Weak' },
  ],
};
const multiPlan: TestPlan = {
  proposedActions: [
    { action: 'add', label: 'Add tests for 1 missing behaviors', count: 1 },
    { action: 'update', label: 'Strengthen 1 weak tests', count: 1 },
  ],
  risk: plan.risk,
  filesToChange: plan.filesToChange,
  questions: [],
};

test('resolveGenerationChanges fills gaps when model returns one change for many behaviors', () => {
  const resolved = resolveGenerationChanges(intent, multiIsolation, multiPlan, [{
    id: 'coupon',
    action: 'Add',
    testType: 'UI / Browser',
    title: 'Apply coupon at checkout',
    file: 'guardrail-tests/ui/checkout.feature',
    feature: 'Checkout',
    risk: 'High',
    reason: 'Covers coupon flow.',
    diff: [{ kind: 'add', text: 'Scenario: Apply coupon at checkout' }],
    status: 'staged',
  }]);

  assert.equal(resolved.length, 2);
  assert.equal(resolved[0]?.title, 'Apply coupon at checkout');
  assert.equal(resolved[1]?.title, 'Show payment errors');
  assert.equal(resolved[1]?.action, 'Update');
});

test('buildGenerationResult stages one fallback per scoped behavior when model is empty', () => {
  const result = buildGenerationResult(intent, multiIsolation, multiPlan, []);
  assert.equal(result.changes.length, 2);
  assert.equal(result.timeline[1]?.label, 'Stage 2 test artifacts');
});

test('resolveGenerationChanges uses source snippet button labels in fallback When step', () => {
  const repository = {
    sourceSnippets: [{
      path: 'frontend/src/pages/CheckoutPage.tsx',
      startLine: 1,
      endLine: 5,
      summary: 'Checkout page',
      text: '<button>Apply coupon</button>',
    }],
  };

  const resolved = resolveGenerationChanges(intent, multiIsolation, multiPlan, [], repository);

  assert.equal(resolved.length, 2);
  const fallbackDiff = resolved[1]?.diff.map(line => line.text).join('\n') ?? '';
  assert.match(fallbackDiff, /When the user clicks Apply coupon/);
});

test('resolveGenerationChanges rejects component source code as button label', () => {
  const repository = {
    sourceSnippets: [{
      path: 'src/components/Button.tsx',
      startLine: 1,
      endLine: 40,
      summary: 'Button component',
      text: `const Button = ({
  children,
  variant = 'primary',
}) => {
  return (
    <button className={baseStyles}>
      {loading && (<svg/>)}
      {children}
    </button>
  );
}`,
    }],
  };

  const resolved = resolveGenerationChanges(intent, isolation, plan, [], repository);
  const diff = resolved[0]?.diff.map(line => line.text).join('\n') ?? '';
  assert.match(diff, /When the user completes the primary flow/);
  assert.doesNotMatch(diff, /variant = 'primary'/);
});

test('resolveGenerationChanges does not treat onClick arrow as button inner text', () => {
  const repository = {
    sourceSnippets: [{
      path: 'src/pages/HomePage.tsx',
      startLine: 1,
      endLine: 3,
      summary: 'Home page',
      text: "<button onClick={() => navigate('/products')}>Shop Now</button>",
    }],
  };

  const resolved = resolveGenerationChanges(intent, isolation, plan, [], repository);
  const diff = resolved[0]?.diff.map(line => line.text).join('\n') ?? '';
  assert.match(diff, /When the user clicks Shop Now/);
});

