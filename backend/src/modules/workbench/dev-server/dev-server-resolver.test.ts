import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveDevServerTarget, resolveRouteFromScenario } from './dev-server-resolver.js';

test('resolves frontend package dev script', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-resolve-'));
  await mkdir(join(root, 'frontend'), { recursive: true });
  await writeFile(join(root, 'frontend', 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
  await writeFile(join(root, 'pnpm-lock.yaml'), '');

  const target = await resolveDevServerTarget(root);
  assert.equal(target?.kind, 'subprocess');
  assert.match(target?.command ?? '', /frontend/);
  assert.equal(target?.cwd, root);
});

test('returns null when no dev script or compose file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-resolve-'));
  await writeFile(join(root, 'README.md'), '# no app');
  const target = await resolveDevServerTarget(root);
  assert.equal(target, null);
});

test('resolveRouteFromScenario extracts path from natural language', () => {
  assert.equal(resolveRouteFromScenario('Open /checkout and verify totals'), '/checkout');
  assert.equal(resolveRouteFromScenario("path: '/onboarding'"), '/onboarding');
  assert.equal(resolveRouteFromScenario('Click the submit button'), '/');
});
