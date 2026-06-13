import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
  assert.ok(context.frontend);
  assert.equal(context.frontend.route, '/onboarding');
  assert.ok(context.qcCases.some(qcCase => qcCase.id === 'QC-ONB-001'));
});

test('scanner ranks source files from real repo files by non-onboarding intent terms', async () => {
  const scanner = new RepositoryScanner({ rootDir: process.cwd() });

  const context = await scanner.scan({
    prompt: 'improve dashboard UI test',
    feature: null,
    testTypes: ['UI / Browser'],
  });

  assert.match(context.relatedFiles[0]?.path ?? '', /dashboard/i);
  assert.match(context.sourceSnippets[0]?.path ?? '', /dashboard/i);
  assert.notEqual(context.relatedFiles[0]?.path, 'frontend/src/pages/OnboardingPage.tsx');
});

test('scanFiles returns ranked files and snippets without hardcoded frontend or qc', async () => {
  const scanner = new RepositoryScanner({ rootDir: process.cwd() });
  const result = await scanner.scanFiles({
    prompt: 'improve onboarding UI test',
    feature: null,
    testTypes: ['UI / Browser'],
  });

  assert.ok(result.relatedFiles.some(file => file.path.includes('Onboarding')));
  assert.ok(result.sourceSnippets.length > 0);
  assert.equal('frontend' in result, false);
  assert.equal('qcCases' in result, false);
});

test('scanner discovers root SPEC.md and resolves checkout route for checkout intent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-spec-'));
  await mkdir(join(root, 'frontend', 'src', 'pages'), { recursive: true });
  await writeFile(join(root, 'SPEC.md'), '# Checkout spec\nCoupon rules.');
  await writeFile(join(root, 'frontend', 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
  await writeFile(join(root, 'frontend', 'vite.config.ts'), `export default { server: { port: 4321 } }`);
  await writeFile(join(root, 'frontend', 'src', 'App.tsx'), `<Route path="/checkout" />`);

  const scanner = new RepositoryScanner({ rootDir: root });
  const context = await scanner.scan({
    prompt: 'checkout coupon UI',
    feature: 'Checkout',
    testTypes: ['UI / Browser'],
  });

  assert.ok(context.specDocs.some(doc => doc.path === 'SPEC.md'));
  assert.equal(context.frontend?.route, '/checkout');
});

test('scanner snippet endLine reflects lines included after char truncation', async () => {
  const scanner = new RepositoryScanner({ rootDir: process.cwd(), maxSnippetChars: 200 });

  const context = await scanner.scan({
    prompt: 'improve onboarding UI test',
    feature: null,
    testTypes: ['UI / Browser'],
  });

  const snippet = context.sourceSnippets.find(
    item => item.path === 'frontend/src/pages/OnboardingPage.tsx',
  );

  assert.ok(snippet);
  assert.equal(snippet.endLine, snippet.text.split('\n').length);
});
