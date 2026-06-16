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
  assert.equal(target?.kind === 'subprocess' ? target.installCommand : undefined, 'pnpm');
  assert.deepEqual(target?.kind === 'subprocess' ? target.installArgs : undefined, ['install', '--frozen-lockfile', '--prod=false']);
});

test('prefers build and preview scripts over vite dev', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-resolve-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'vite build', preview: 'vite preview', dev: 'vite' } }));
  await writeFile(join(root, 'package-lock.json'), '');

  const target = await resolveDevServerTarget(root);
  assert.equal(target?.kind, 'subprocess');
  assert.equal(target?.command, 'npm');
  assert.deepEqual(target?.args, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(target?.port)]);
  assert.equal(target?.kind === 'subprocess' ? target.buildCommand : undefined, 'npm');
  assert.deepEqual(target?.kind === 'subprocess' ? target.buildArgs : undefined, ['run', 'build']);
});

test('resolves standalone nested frontend package from its own directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-resolve-'));
  await mkdir(join(root, 'frontend'), { recursive: true });
  await writeFile(join(root, 'frontend', 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
  await writeFile(join(root, 'frontend', 'package-lock.json'), '');

  const target = await resolveDevServerTarget(root);
  assert.equal(target?.kind, 'subprocess');
  assert.equal(target?.command, 'npm');
  assert.deepEqual(target?.args.slice(0, 2), ['run', 'dev']);
  assert.equal(target?.cwd, join(root, 'frontend'));
  assert.deepEqual(target?.kind === 'subprocess' ? target.installArgs : undefined, ['install', '--include=dev', '--no-audit', '--no-fund']);
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
