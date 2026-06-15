import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedUnitContent } from './unit-test-runner-style.js';

test('rejects tautological Vitest assertions', () => {
  assert.throws(
    () => validateGeneratedUnitContent(
      "import { expect, it } from 'vitest';\nimport { total } from './cart';\nit('fake', () => expect(true).toBe(true));\n",
      'vitest',
      'src/cart.test.ts',
    ),
    /tautological assertion/i,
  );
});

test('rejects node assert placeholders', () => {
  assert.throws(
    () => validateGeneratedUnitContent(
      "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { total } from './cart.js';\ntest('fake', () => { total([]); assert.ok(true); });\n",
      'node:test',
      'src/cart.test.ts',
    ),
    /tautological assertion/i,
  );
});

test('rejects tests that do not import local production code', () => {
  assert.throws(
    () => validateGeneratedUnitContent(
      "import { expect, it } from 'vitest';\nit('math', () => expect(1 + 1).toBe(2));\n",
      'vitest',
      'src/cart.test.ts',
    ),
    /does not import a local production module/i,
  );
});

test('rejects tests that import but do not exercise production code', () => {
  assert.throws(
    () => validateGeneratedUnitContent(
      "import { expect, it } from 'vitest';\nimport { calculateTotal } from './cart';\nit('math', () => expect(1 + 1).toBe(2));\n",
      'vitest',
      'src/cart.test.ts',
    ),
    /does not exercise it/i,
  );
});

test('accepts tests that exercise local production code and assert its result', () => {
  assert.doesNotThrow(() => validateGeneratedUnitContent(
    "import { expect, it } from 'vitest';\nimport { calculateTotal } from './cart';\nit('totals quantities', () => expect(calculateTotal([{ price: 5, quantity: 2 }])).toBe(10));\n",
    'vitest',
    'src/cart.test.ts',
  ));
});

test('rejects generated TypeScript with parser errors before the run step', () => {
  assert.throws(
    () => validateGeneratedUnitContent(
      [
        "import { expect, it } from 'vitest';",
        "import { submitCheckout } from './checkout';",
        "it('submits checkout', () => {",
        "  const result = submitCheckout() unexpectedIdentifier",
        "  expect(result).toBeDefined();",
        '});',
      ].join('\n'),
      'vitest',
      'src/checkout.test.ts',
    ),
    /invalid TypeScript syntax/i,
  );
});
