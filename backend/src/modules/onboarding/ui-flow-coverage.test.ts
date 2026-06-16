import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUiFlowCoverage } from './onboarding-scan.service.js';
import type { RepoScanFacts } from './onboarding.types.js';

function facts(sourceFiles: string[], testFiles: string[]): RepoScanFacts {
  return {
    filesIndexed: 0, sourceFiles, testFiles, sourceSnippets: [], testSnippets: [], skippedLargeFiles: 0,
    modules: [], detectedStack: [], packageManager: 'npm', commands: {},
  };
}

test('buildUiFlowCoverage marks a page covered when a UI feature references it', () => {
  const result = buildUiFlowCoverage(facts(
    ['src/pages/CheckoutPage.tsx', 'src/pages/WishlistPage.tsx', 'src/pages/index.ts'],
    ['src/test/checkout-form-validation-email.feature'],
  ));
  assert.deepEqual(result.covered, ['CheckoutPage']);
  assert.deepEqual(result.uncovered, ['WishlistPage']); // index.ts barrel skipped
  assert.equal(result.percent, 50);
});

test('buildUiFlowCoverage returns null percent when there are no pages', () => {
  const result = buildUiFlowCoverage(facts(['src/store/cartStore.ts'], ['src/test/x.feature']));
  assert.equal(result.percent, null);
  assert.deepEqual(result.covered, []);
});

test('buildUiFlowCoverage only counts UI test files (.feature/e2e), not unit specs', () => {
  const result = buildUiFlowCoverage(facts(
    ['src/pages/HomePage.tsx'],
    ['src/test/home.test.ts'], // unit spec, not a UI test → does not cover
  ));
  assert.equal(result.percent, 0);
  assert.deepEqual(result.uncovered, ['HomePage']);
});
