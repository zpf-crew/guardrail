import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActionForProgress } from './ui-browser-agent-context.js';
import type { GherkinStep } from './gherkin-step-parser.js';

const steps: GherkinStep[] = [
  { index: 0, kind: 'Given', effectiveKind: 'Given', text: 'the user is on the home page' },
  { index: 1, kind: 'When', effectiveKind: 'When', text: 'the user clicks Shop Now' },
  { index: 2, kind: 'Then', effectiveKind: 'Then', text: 'the products page is displayed' },
];

test('formatActionForProgress uses human-readable Gherkin step labels', () => {
  assert.equal(
    formatActionForProgress({ kind: 'stepComplete', stepIndex: 0, note: 'ok' }, steps, 0),
    'Done — Step 1/3 — Given: the user is on the home page',
  );
  assert.equal(
    formatActionForProgress({
      kind: 'assertThen',
      stepIndex: 2,
      satisfied: true,
      reason: 'Products heading visible',
    }, steps, 2),
    'Verified — Step 3/3 — Then: the products page is displayed',
  );
});

test('formatActionForProgress describes agent-browser commands', () => {
  assert.equal(
    formatActionForProgress({
      kind: 'agentBrowserCommand',
      command: 'find',
      args: ['role', 'button', 'click', 'Add to Cart'],
      reason: 'Click Add to Cart',
    }, steps, 1),
    'agent-browser find role button click Add to Cart — Step 2/3 — When: the user clicks Shop Now',
  );
});
