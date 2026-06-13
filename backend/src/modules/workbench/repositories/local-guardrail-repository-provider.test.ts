import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalGuardrailRepositoryProvider } from './local-guardrail-repository-provider.js';

test('local provider returns Guardrail onboarding context with schema-shaped QC cases', async () => {
  const provider = new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() });
  const context = await provider.getContext('mock');

  assert.equal(context.repo.name, 'guardrail');
  assert.equal(context.frontend.url, 'http://localhost:5173/onboarding');
  assert.ok(context.relatedFiles.some(file => file.path.includes('OnboardingPage.tsx')));
  assert.equal(context.qcCases[0]?.feature, 'Checkout');
  assert.equal(context.qcCases[0]?.automationStatus, 'missing');
});
