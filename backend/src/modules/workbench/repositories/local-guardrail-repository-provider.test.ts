import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalGuardrailRepositoryProvider } from './local-guardrail-repository-provider.js';

test('local provider returns Guardrail onboarding context with schema-shaped QC cases', async () => {
  const provider = new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() });
  const context = await provider.getContext('guardrail', {
    prompt: 'improve onboarding UI test',
    feature: null,
    testTypes: ['UI / Browser'],
    sources: ['Codebase'],
  });

  assert.equal(context.repo.name, 'guardrail');
  assert.match(context.repo.path, /guardrail$/);
  assert.equal(context.frontend.url, 'http://127.0.0.1:5173/onboarding');
  assert.ok(context.relatedFiles.some(file => file.path === 'frontend/src/pages/OnboardingPage.tsx'));
  assert.ok(context.sourceSnippets.some(snippet => snippet.path === 'frontend/src/pages/OnboardingPage.tsx'));
  assert.equal(context.qcCases[0]?.feature, 'Onboarding');
  assert.equal(context.qcCases[0]?.automationStatus, 'missing');
});

test('local provider returns fresh scanner results between calls', async () => {
  const provider = new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() });
  const intent = {
    prompt: 'improve onboarding UI test',
    feature: null,
    testTypes: ['UI / Browser' as const],
    sources: ['Codebase' as const],
  };
  const firstContext = await provider.getContext('guardrail', intent);

  assert.ok(firstContext.relatedFiles[0]);
  assert.ok(firstContext.qcCases[0]);

  firstContext.relatedFiles[0].path = 'mutated/path.ts';
  firstContext.qcCases[0].automationStatus = 'automated';
  firstContext.qcCases.push({
    id: 'QC-MUTATED',
    feature: 'Checkout',
    scenario: 'Mutated caller-owned case',
    expectedResult: 'Should not leak into future contexts.',
    priority: 'Low',
    automationStatus: 'automated',
  });

  const secondContext = await provider.getContext('guardrail', intent);

  assert.ok(secondContext.relatedFiles.some(file => file.path === 'frontend/src/pages/OnboardingPage.tsx'));
  assert.equal(secondContext.qcCases.length, 1);
  assert.equal(secondContext.qcCases[0]?.automationStatus, 'missing');
});

test('local provider rejects unsupported repository ids clearly', async () => {
  const provider = new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() });

  await assert.rejects(
    () => provider.getContext('mock'),
    /Unsupported local Guardrail repository id "mock"/,
  );
});
