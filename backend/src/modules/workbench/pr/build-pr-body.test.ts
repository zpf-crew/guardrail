import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPullRequestBody } from './build-pr-body.js';
import type { GeneratedChange, TestRunResult, ReviewSummary } from '../workbench.types.js';

function change(file: string, title: string): GeneratedChange {
  return { id: file, action: 'Add', testType: 'UI / Browser', title, file, feature: 'Checkout', risk: 'High', reason: 'r', diff: [{ kind: 'add', text: 'x' }], status: 'staged' };
}

const run = {
  unit: { command: 'n', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
  ui: { command: 'agent-browser', browser: 'Chromium', outcome: 'Failed', passed: 1, durationMs: 1, evidence: [] },
  mobile: { command: 'n', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
  coverage: [],
  matrix: [
    { title: 'Modal escape', type: 'UI / Browser', status: 'Passed', duration: '1s', evidence: null, reason: null, file: 'src/test/modal.feature' },
    { title: 'Checkout validation', type: 'UI / Browser', status: 'Failed', duration: '1s', evidence: null, reason: 'Form submitted invalid email', file: 'src/test/checkout.feature' },
    { title: 'Route mapping', type: 'UI / Browser', status: 'Skipped', duration: null, evidence: null, reason: 'Skipped after upstream failure', file: 'src/test/routes.feature' },
  ],
} as unknown as TestRunResult;

const review = {
  testsAdded: 3, testsUpdated: 0, testsDeleted: 0, testsPassing: '1/3',
  coverage: { lineDelta: 0, branchDelta: 0 }, flakyTracked: 0, filesChanged: [],
  failures: [{ title: 'Checkout validation', type: 'UI / Browser', kind: 'failed', reason: 'Form submitted invalid email', file: 'src/test/checkout.feature', likelyCause: 'Loose regex', suggestedFix: 'Require a TLD' }],
  remainingRisk: [], openQuestions: 0, recommendation: 'Review before applying.',
} as ReviewSummary;

test('buildPullRequestBody includes summary, per-test status, and issues', () => {
  const body = buildPullRequestBody({
    changes: [change('src/test/modal.feature', 'Modal escape'), change('src/test/checkout.feature', 'Checkout validation'), change('src/test/routes.feature', 'Route mapping')],
    run,
    review,
  });
  assert.match(body, /Passing: \*\*1\/3\*\*/);
  assert.match(body, /Modal escape.*passed/);
  assert.match(body, /## Issues to resolve/);
  assert.match(body, /Checkout validation/);
  assert.match(body, /Likely cause:\*\* Loose regex/);
  // Skipped tests are surfaced as issues too.
  assert.match(body, /Route mapping/);
});

test('buildPullRequestBody works without run/review (plan-only)', () => {
  const body = buildPullRequestBody({ changes: [change('src/test/a.feature', 'A')] });
  assert.match(body, /## Tests added/);
  assert.match(body, /`src\/test\/a.feature` — A/);
  assert.doesNotMatch(body, /## Issues to resolve/);
});
