import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoverageSummaryJson, parseCoverageFinalJson } from './coverage-report-parser.js';
import { buildEffectiveFileCoverage, aggregateModuleCoverage } from './onboarding-scan.service.js';

const ROOT = '/clone';

test('buildEffectiveFileCoverage infers 0% for source files absent from the report', () => {
  const reported = [{ path: 'src/data/index.ts', line: 82, branch: 78 }];
  const sourceFiles = ['src/data/index.ts', 'src/pages/CheckoutPage.tsx', 'src/components/Ui/Button.tsx'];
  const effective = buildEffectiveFileCoverage(reported, sourceFiles);
  assert.deepEqual(effective, [
    { path: 'src/data/index.ts', line: 82, branch: 78 },
    { path: 'src/pages/CheckoutPage.tsx', line: 0, branch: 0 },
    { path: 'src/components/Ui/Button.tsx', line: 0, branch: 0 },
  ]);
});

test('aggregateModuleCoverage averages per-file into modules', () => {
  const modules = aggregateModuleCoverage([
    { path: 'src/data/index.ts', line: 82, branch: 78 },
    { path: 'src/data/products.ts', line: 60, branch: 40 },
    { path: 'src/pages/CheckoutPage.tsx', line: 0, branch: 0 },
  ]);
  // src/data/* collapses to the "Data" module (averaged); each page file is its own module.
  assert.deepEqual(modules.get('Data'), { line: 71, branch: 59 });
  assert.deepEqual(modules.get('CheckoutPage.Tsx'), { line: 0, branch: 0 });
});

test('parseCoverageSummaryJson reads per-file pct and skips total', () => {
  const raw = JSON.stringify({
    total: { lines: { pct: 50 } },
    '/clone/src/Store/cart.ts': { lines: { pct: 88 }, branches: { pct: 70 } },
    'src/pages/CheckoutPage.tsx': { lines: { pct: 0 }, branches: { pct: 0 } },
  });
  const files = parseCoverageSummaryJson(raw, ROOT);
  assert.deepEqual(files, [
    { path: 'src/Store/cart.ts', line: 88, branch: 70 },
    { path: 'src/pages/CheckoutPage.tsx', line: 0, branch: 0 },
  ]);
});

test('parseCoverageSummaryJson falls back branch to line pct when branches missing', () => {
  const raw = JSON.stringify({ '/clone/src/Data/x.ts': { lines: { pct: 95 } } });
  assert.deepEqual(parseCoverageSummaryJson(raw, ROOT), [{ path: 'src/Data/x.ts', line: 95, branch: 95 }]);
});

test('parseCoverageFinalJson computes pct from statement and branch hit maps', () => {
  const raw = JSON.stringify({
    '/clone/src/Store/cart.ts': {
      path: '/clone/src/Store/cart.ts',
      s: { '0': 1, '1': 1, '2': 0, '3': 1 }, // 3/4 = 75
      b: { '0': [1, 0], '1': [1, 1] }, // 3/4 = 75
    },
  });
  assert.deepEqual(parseCoverageFinalJson(raw, ROOT), [{ path: 'src/Store/cart.ts', line: 75, branch: 75 }]);
});

test('parseCoverageFinalJson treats files with no branches as 0 branch coverage', () => {
  const raw = JSON.stringify({ '/clone/src/Data/x.ts': { path: '/clone/src/Data/x.ts', s: { '0': 1, '1': 1 }, b: {} } });
  assert.deepEqual(parseCoverageFinalJson(raw, ROOT), [{ path: 'src/Data/x.ts', line: 100, branch: 0 }]);
});

test('both parsers return [] on malformed JSON', () => {
  assert.deepEqual(parseCoverageSummaryJson('not json', ROOT), []);
  assert.deepEqual(parseCoverageFinalJson('{bad', ROOT), []);
});
