import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeChangesToClone } from './write-changes.js';
import type { GeneratedChange } from '../workbench.types.js';

function change(file: string, addLines: string[], action: GeneratedChange['action'] = 'Add'): GeneratedChange {
  return {
    id: file,
    action,
    testType: 'UI / Browser',
    title: file,
    file,
    feature: 'Checkout',
    risk: 'High',
    reason: 'r',
    diff: addLines.map(text => ({ kind: 'add' as const, text })),
    status: 'staged',
  };
}

test('writeChangesToClone reconstructs file content from add lines', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'guardrail-write-'));
  const touched = await writeChangesToClone(root, [
    change('src/test/a.feature', ['Feature: A', '  Scenario: one']),
  ]);
  assert.deepEqual(touched, ['src/test/a.feature']);
  const content = await readFile(path.join(root, 'src/test/a.feature'), 'utf8');
  assert.equal(content, 'Feature: A\n  Scenario: one\n');
});

test('writeChangesToClone deletes files for Delete actions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'guardrail-write-'));
  await writeChangesToClone(root, [change('src/test/gone.feature', ['x'])]);
  await writeChangesToClone(root, [change('src/test/gone.feature', [], 'Delete')]);
  await assert.rejects(stat(path.join(root, 'src/test/gone.feature')));
});

test('writeChangesToClone refuses paths that escape the clone root', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'guardrail-write-'));
  await assert.rejects(
    writeChangesToClone(root, [change('../../etc/evil.feature', ['x'])]),
    /outside the repository/,
  );
});
