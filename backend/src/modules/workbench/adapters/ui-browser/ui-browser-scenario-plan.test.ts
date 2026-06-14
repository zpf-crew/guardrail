import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScenarioPlanGrounded } from './ui-browser-scenario-plan.js';

const addToCartScenario = `
Scenario: Add product to cart from homepage
  Given the homepage is loaded
  When I click the "Add to Cart" button for the first available product
  Then the cart should contain at least 1 item
`;

test('scenario plan grounding rejects unrelated quantity-decrease plans', () => {
  assert.throws(
    () => assertScenarioPlanGrounded({
      title: 'Decrease product quantity on page',
      steps: [
        {
          id: 'step-1',
          kind: 'setup',
          sourceStepIndexes: [0],
          instruction: 'Navigate to the target page',
          successCriteria: 'The page loads',
        },
        {
          id: 'step-2',
          kind: 'action',
          sourceStepIndexes: [1],
          instruction: 'Find the Decrease quantity button and click it',
          successCriteria: 'The button has been clicked',
        },
        {
          id: 'step-3',
          kind: 'assert',
          sourceStepIndexes: [2],
          instruction: 'Verify the quantity has decreased',
          successCriteria: 'The visible quantity value is lower than before',
        },
      ],
    }, addToCartScenario),
    /Unsupported term\(s\): decrease, quantity/,
  );
});

test('scenario plan grounding accepts grounded add-to-cart plans', () => {
  assert.doesNotThrow(() => assertScenarioPlanGrounded({
    title: 'Add product to cart',
    steps: [
      {
        id: 'step-1',
        kind: 'setup',
        sourceStepIndexes: [0],
        instruction: 'Navigate to the homepage',
        successCriteria: 'The homepage is loaded',
      },
      {
        id: 'step-2',
        kind: 'action',
        sourceStepIndexes: [1],
        instruction: 'Find the first Add to Cart button, scrolling if needed, and click it',
        successCriteria: 'The click completes',
      },
      {
        id: 'step-3',
        kind: 'assert',
        sourceStepIndexes: [2],
        instruction: 'Verify the cart contains at least 1 item',
        successCriteria: 'The cart contains at least 1 item',
      },
    ],
  }, addToCartScenario));
});
