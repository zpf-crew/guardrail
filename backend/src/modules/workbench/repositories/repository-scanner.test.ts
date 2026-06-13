import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryScanner } from './repository-scanner.js';

test('scanner finds onboarding files from local guardrail repo', async () => {
  const scanner = new RepositoryScanner({ rootDir: process.cwd() });

  const context = await scanner.scan({
    prompt: 'improve onboarding UI test',
    feature: null,
    testTypes: ['UI / Browser'],
  });

  const onboardingSnippet = context.sourceSnippets.find(
    snippet => snippet.path === 'frontend/src/pages/OnboardingPage.tsx',
  );

  assert.equal(context.repo.name, 'guardrail');
  assert.ok(context.relatedFiles.some(file => file.path === 'frontend/src/pages/OnboardingPage.tsx'));
  assert.ok(onboardingSnippet);
  assert.equal(onboardingSnippet.startLine, 1);
  assert.ok(onboardingSnippet.endLine >= onboardingSnippet.startLine);
  assert.ok(onboardingSnippet.text.length > 0);
  assert.equal(context.frontend.route, '/onboarding');
  assert.ok(context.qcCases.some(qcCase => qcCase.id === 'QC-ONB-001'));
});
