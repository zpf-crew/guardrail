import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkbenchArtifactStore } from './workbench-artifact-store.js';

test('artifact store copies local screenshot and returns browser URL', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-source-'));
  const source = path.join(sourceDir, 'onboarding.png');
  await writeFile(source, Buffer.from('fake-png'));

  const store = new WorkbenchArtifactStore({ rootDir: root });
  const evidence = await store.registerEvidence({
    sessionId: 'session-1',
    jobId: 'job-1',
    evidence: { kind: 'screenshot', label: 'Onboarding screenshot', href: source },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Onboarding screenshot');
  assert.match(evidence.href ?? '', /^\/api\/workbench\/session-1\/artifacts\/.+\.png$/);

  const artifactId = evidence.href?.split('/').at(-1);
  assert.ok(artifactId);
  const artifact = store.getArtifact('session-1', artifactId);
  assert.ok(artifact);
  assert.equal(artifact.contentType, 'image/png');
  assert.equal(await readFile(artifact.filePath, 'utf8'), 'fake-png');
});

test('artifact store extracts a path from agent-browser screenshot stdout', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-source-'));
  const source = path.join(sourceDir, 'screen.png');
  await writeFile(source, Buffer.from('png'));

  const store = new WorkbenchArtifactStore({ rootDir: root });
  const evidence = await store.registerEvidence({
    sessionId: 'session-2',
    jobId: 'job-2',
    evidence: {
      kind: 'screenshot',
      label: 'Agent browser screenshot',
      href: `✓ Screenshot saved to ${source}`,
    },
  });

  assert.match(evidence.href ?? '', /^\/api\/workbench\/session-2\/artifacts\/.+\.png$/);
});

test('artifact store keeps metadata when local file cannot be copied', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const allowedRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-allowed-source-'));
  const missingSource = path.join(allowedRoot, 'missing.png');
  await mkdir(missingSource);
  const store = new WorkbenchArtifactStore({ rootDir: root, allowedSourceRoots: [allowedRoot] });

  const evidence = await store.registerEvidence({
    sessionId: 'session-3',
    jobId: 'job-3',
    evidence: { kind: 'screenshot', label: 'Missing screenshot', href: missingSource },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Missing screenshot');
  assert.equal(evidence.href, undefined);
});

test('artifact store refuses symlinked screenshot sources outside allowed roots', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const allowedRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-allowed-source-'));
  const untrustedRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-untrusted-source-'));
  const target = path.join(untrustedRoot, 'secret.png');
  const source = path.join(allowedRoot, 'screen.png');
  await writeFile(target, Buffer.from('secret'));
  await symlink(target, source);

  const store = new WorkbenchArtifactStore({ rootDir: root, allowedSourceRoots: [allowedRoot] });
  const evidence = await store.registerEvidence({
    sessionId: 'session-4',
    jobId: 'job-4',
    evidence: { kind: 'screenshot', label: 'Symlink screenshot', href: source },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Symlink screenshot');
  assert.equal(evidence.href, undefined);
});

test('artifact store refuses screenshot sources outside allowed roots', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const allowedRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-allowed-source-'));
  const untrustedRoot = await mkdtemp(path.join(os.tmpdir(), 'guardrail-untrusted-source-'));
  const source = path.join(untrustedRoot, 'secret.png');
  await writeFile(source, Buffer.from('secret'));

  const store = new WorkbenchArtifactStore({ rootDir: root, allowedSourceRoots: [allowedRoot] });
  const evidence = await store.registerEvidence({
    sessionId: 'session-4',
    jobId: 'job-4',
    evidence: { kind: 'screenshot', label: 'Untrusted screenshot', href: source },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Untrusted screenshot');
  assert.equal(evidence.href, undefined);
});

test('artifact store rejects traversal-like destination ids', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-source-'));
  const source = path.join(sourceDir, 'screen.png');
  await writeFile(source, Buffer.from('png'));

  const store = new WorkbenchArtifactStore({ rootDir: root });
  const evidence = await store.registerEvidence({
    sessionId: '../session-5',
    jobId: 'job-5/../../escape',
    evidence: { kind: 'screenshot', label: 'Traversal screenshot', href: source },
  });

  assert.equal(evidence.kind, 'screenshot');
  assert.equal(evidence.label, 'Traversal screenshot');
  assert.equal(evidence.href, undefined);
});

test('artifact store returns undefined for unknown artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardrail-artifacts-'));
  const store = new WorkbenchArtifactStore({ rootDir: root });

  assert.equal(store.getArtifact('missing-session', 'missing.png'), undefined);
});
