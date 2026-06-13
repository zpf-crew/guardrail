import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewSummary } from './review-summary-builder.js';

test('buildReviewSummary counts changes and run outcomes', () => {
  const summary = buildReviewSummary({
    generation: {
      timeline: [],
      changes: [
        { id: 'a', action: 'Add', testType: 'UI / Browser', title: 'T1', file: 'guardrail-tests/ui/a.feature', feature: 'Checkout', risk: 'High', reason: 'r', diff: [{ kind: 'add', text: 'x' }], status: 'staged' },
      ],
      beforeAfter: { before: ['none'], after: ['one'] },
    },
    run: {
      unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
      ui: { command: 'agent-browser open http://localhost:5173/onboarding', browser: 'Chromium', outcome: 'Passed', passed: 1, durationMs: 1200, evidence: [{ kind: 'screenshot', label: 'Loaded', href: '/api/workbench/s/a.png' }] },
      mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      coverage: [{ metric: 'Line coverage', before: 40, after: 40 }],
      matrix: [{ title: 'T1', type: 'UI / Browser', status: 'Passed', duration: '1.2s', evidence: 'screenshot', file: 'guardrail-tests/ui/a.feature' }],
    },
  }, 'Apply after reviewing screenshot evidence.');

  assert.equal(summary.testsAdded, 1);
  assert.equal(summary.testsPassing, '1/1');
  assert.equal(summary.filesChanged[0]?.changeKind, 'add');
  assert.match(summary.recommendation, /screenshot/i);
});

test('buildReviewSummary counts unresolved plan questions', () => {
  const summary = buildReviewSummary({
    generation: {
      timeline: [],
      changes: [
        { id: 'a', action: 'Add', testType: 'UI / Browser', title: 'T1', file: 'guardrail-tests/ui/a.feature', feature: 'Checkout', risk: 'High', reason: 'r', diff: [{ kind: 'add', text: 'x' }], status: 'staged' },
      ],
      beforeAfter: { before: ['none'], after: ['one'] },
    },
    run: {
      unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
      ui: { command: 'agent-browser open http://localhost:5173/onboarding', browser: 'Chromium', outcome: 'Passed', passed: 1, durationMs: 1200, evidence: [] },
      mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      coverage: [{ metric: 'Line coverage', before: 40, after: 40 }],
      matrix: [{ title: 'T1', type: 'UI / Browser', status: 'Passed', duration: '1.2s', evidence: null, file: 'guardrail-tests/ui/a.feature' }],
    },
    plan: {
      proposedActions: [{ action: 'add', label: 'Add tests', count: 1 }],
      risk: {
        productionCodeChanges: 'none',
        testDataChanges: false,
        browserAutomationRequired: true,
        mobileSimulatorRequired: 'no',
        externalApiMocking: 'no',
      },
      filesToChange: ['guardrail-tests/ui/a.feature'],
      questions: [{ id: 'q1', question: 'A?', options: ['Yes', 'No'] }],
    },
    approval: { decision: 'approve', answers: {} },
  }, 'Review evidence.');

  assert.equal(summary.openQuestions, 1);
});
