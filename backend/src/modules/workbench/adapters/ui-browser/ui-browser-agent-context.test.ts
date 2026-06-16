import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentIterationContext,
  formatActionForHistory,
  formatActionForProgress,
} from './ui-browser-agent-context.js';
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

test('formatActionForProgress redacts typed values from browser commands', () => {
  assert.equal(
    formatActionForProgress({
      kind: 'agentBrowserCommand',
      command: 'fill',
      args: ['@e2', 'secret search'],
      reason: 'Fill search field',
    }, steps, 1),
    'agent-browser fill @e2 [redacted] — Step 2/3 — When: the user clicks Shop Now',
  );
  assert.equal(
    formatActionForHistory({
      kind: 'agentBrowserCommand',
      command: 'keyboard',
      args: ['inserttext', 'hidden value'],
      reason: 'Insert text',
    }),
    'keyboard inserttext [redacted]',
  );
});

test('buildAgentIterationContext marks Then turns as observation-allowed before any observation', () => {
  const context = buildAgentIterationContext({
    scenarioTitle: 'Add to cart',
    gherkinSteps: steps,
    currentStepIndex: 2,
    completedSteps: [{ index: 0, note: 'Home open' }, { index: 1, note: 'Clicked' }],
    thenVerdicts: [],
    pageSnapshot: '- link "Shopping cart 1" @e4',
    actionHistory: [],
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    startedAt: Date.now(),
    iterationsUsed: 3,
    observationOnlyActionsForCurrentStep: 0,
  });

  assert.equal(context.currentStep.effectiveKind, 'Then');
  assert.equal(context.currentStep.observationOnlyActionsUsed, 0);
  assert.equal(context.currentStep.observationOnlyActionsRemaining, 3);
  assert.equal(context.currentStep.verdictRequiredNow, false);
  assert.deepEqual(context.allowedActionKinds, ['agentBrowserCommand', 'assertThen', 'stepFailed']);
  assert.deepEqual(context.allowedCommands, ['snapshot', 'get', 'is', 'scroll', 'click']);
});

test('buildAgentIterationContext allows up to three Then observations before requiring verdict', () => {
  const context = buildAgentIterationContext({
    scenarioTitle: 'Add to cart',
    gherkinSteps: steps,
    currentStepIndex: 2,
    completedSteps: [{ index: 0, note: 'Home open' }, { index: 1, note: 'Clicked' }],
    thenVerdicts: [],
    pageSnapshot: '- link "Shopping cart 1" @e4',
    actionHistory: [{ iteration: 3, action: 'snapshot -i', result: 'ok' }],
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    startedAt: Date.now(),
    iterationsUsed: 4,
    observationOnlyActionsForCurrentStep: 2,
  });

  assert.equal(context.currentStep.observationOnlyActionsRemaining, 1);
  assert.equal(context.currentStep.verdictRequiredNow, false);
  assert.deepEqual(context.allowedActionKinds, ['agentBrowserCommand', 'assertThen', 'stepFailed']);
  assert.deepEqual(context.allowedCommands, ['snapshot', 'get', 'is', 'scroll', 'click']);
});

test('buildAgentIterationContext requires verdict after three Then observations', () => {
  const context = buildAgentIterationContext({
    scenarioTitle: 'Add to cart',
    gherkinSteps: steps,
    currentStepIndex: 2,
    completedSteps: [{ index: 0, note: 'Home open' }, { index: 1, note: 'Clicked' }],
    thenVerdicts: [],
    pageSnapshot: '- link "Shopping cart 1" @e4',
    actionHistory: [{ iteration: 3, action: 'snapshot -i', result: 'ok' }],
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    startedAt: Date.now(),
    iterationsUsed: 4,
    observationOnlyActionsForCurrentStep: 3,
  });

  assert.equal(context.currentStep.observationOnlyActionsRemaining, 0);
  assert.equal(context.currentStep.verdictRequiredNow, true);
  assert.deepEqual(context.allowedActionKinds, ['assertThen', 'stepFailed']);
  assert.deepEqual(context.allowedCommands, []);
});

test('buildAgentIterationContext allows scenario completion when all Then steps are satisfied', () => {
  const context = buildAgentIterationContext({
    scenarioTitle: 'Add to cart',
    gherkinSteps: steps,
    currentStepIndex: 2,
    completedSteps: [{ index: 0, note: 'Home open' }, { index: 1, note: 'Clicked' }],
    thenVerdicts: [{
      stepIndex: 2,
      text: 'the products page is displayed',
      satisfied: true,
      reason: 'Products page is displayed',
    }],
    pageSnapshot: '- heading "Products" @e4',
    actionHistory: [{ iteration: 4, action: 'assertThen 2 true', result: 'ok' }],
    constraints: { behavior: 'Add to cart', maxStepDurationMs: 60_000, maxSteps: 15 },
    startedAt: Date.now(),
    iterationsUsed: 5,
    observationOnlyActionsForCurrentStep: 3,
  });

  assert.deepEqual(context.allowedActionKinds, ['assertThen', 'stepFailed', 'scenarioComplete']);
  assert.deepEqual(context.allowedCommands, []);
});

test('ui browser run skill describes verdict-only Then turns without screenshot loops', async () => {
  const { readFile } = await import('node:fs/promises');
  const skill = await readFile(new URL('../../../../../../guardrail-skills/test-run-ui-browser-agent.md', import.meta.url), 'utf8');

  assert.match(skill, /verdictRequiredNow/);
  assert.match(skill, /allowedActionKinds/);
  assert.match(skill, /allowedCommands/);
  assert.match(skill, /currentStep\.observationOnlyActionsRemaining/);
  assert.match(skill, /If `currentStep\.verdictRequiredNow` is true/);
  assert.match(skill, /Screenshots are runner-owned evidence\./);
  const skillWithoutRunnerEvidence = skill.replace(/Screenshots are runner-owned evidence\./g, '');
  assert.doesNotMatch(skillWithoutRunnerEvidence, /\bscreenshots?\b/i);
  assert.doesNotMatch(skill, /command `screenshot`/);
  assert.doesNotMatch(skill, /"command": "screenshot"/);
  assert.doesNotMatch(skill, /\bscreenshot\b.*allowed output/i);
});
