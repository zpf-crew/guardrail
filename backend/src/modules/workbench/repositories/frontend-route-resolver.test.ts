import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveFrontendContext } from './frontend-route-resolver.js';

test('resolveFrontendContext finds react-router paths and vite dev port', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-routes-'));
  await mkdir(join(root, 'frontend', 'src'), { recursive: true });
  await writeFile(join(root, 'frontend', 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
  await writeFile(join(root, 'frontend', 'vite.config.ts'), `export default { server: { port: 4321 } }`);
  await writeFile(join(root, 'frontend', 'src', 'App.tsx'), `
    import { Routes, Route } from 'react-router-dom';
    export default function App() {
      return (
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      );
    }
  `);

  const result = await resolveFrontendContext(root, {
    prompt: 'checkout UI test',
    feature: 'Checkout',
    testTypes: ['UI / Browser'],
  });

  assert.equal(result?.route, '/checkout');
  assert.equal(result?.url, 'http://127.0.0.1:4321/checkout');
  assert.ok(result?.healthUrl?.includes('4321'));
});

test('resolveFrontendContext returns null when no frontend package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-routes-'));
  await writeFile(join(root, 'package.json'), '{}');
  const result = await resolveFrontendContext(root, { prompt: '', feature: null, testTypes: ['UI / Browser'] });
  assert.equal(result, null);
});
