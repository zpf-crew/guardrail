import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { walkRepositoryFiles } from './repo-file-walker.js';

test('walkRepositoryFiles inventories files without ripgrep', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guardrail-walk-'));
  await mkdir(join(root, 'src', 'pages'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'ignored'), { recursive: true });
  await writeFile(join(root, 'src', 'pages', 'Home.tsx'), 'export default function Home() {}');
  await writeFile(join(root, 'node_modules', 'ignored', 'dep.js'), 'ignored');

  const files = await walkRepositoryFiles(root);

  assert.ok(files.includes('src/pages/Home.tsx'));
  assert.equal(files.some(file => file.includes('node_modules')), false);
});
