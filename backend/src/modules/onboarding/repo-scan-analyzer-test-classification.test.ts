import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeRepo } from './repo-scan-analyzer.js';

/**
 * The UI-flow loop only closes if the scanner classifies the generated Gherkin test
 * (`guardrail-tests/ui/*.feature`) as a test file — otherwise it never reaches
 * `facts.testFiles` and UI Flow Coverage stays at 0 after the PR merges.
 */
test('analyzeRepo classifies guardrail-tests/ui/*.feature as a test file, page as source', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'guardrail-scan-'));
  await mkdir(path.join(root, 'src/pages'), { recursive: true });
  await mkdir(path.join(root, 'guardrail-tests/ui'), { recursive: true });
  await writeFile(path.join(root, 'src/pages/CartPage.tsx'), 'export default function CartPage() { return null; }');
  await writeFile(path.join(root, 'guardrail-tests/ui/add-item-to-cart.feature'), 'Feature: cart\n  Scenario: add item\n');
  // `.feature` substring in a path must NOT be mistaken for a test file.
  await writeFile(path.join(root, 'src/feature-flags.ts'), 'export const flags = {};');

  const facts = await analyzeRepo(root);

  assert.ok(
    facts.testFiles.includes('guardrail-tests/ui/add-item-to-cart.feature'),
    'generated .feature test should be classified as a test file',
  );
  assert.ok(facts.sourceFiles.includes('src/pages/CartPage.tsx'));
  assert.ok(!facts.testFiles.includes('src/feature-flags.ts'), 'feature-flags.ts is source, not a test');
  assert.ok(facts.sourceFiles.includes('src/feature-flags.ts'));
});
