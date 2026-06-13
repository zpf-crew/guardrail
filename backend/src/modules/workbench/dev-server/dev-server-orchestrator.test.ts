import test from 'node:test';
import assert from 'node:assert/strict';
import { DevServerOrchestrator } from './dev-server-orchestrator.js';

test('starts subprocess and returns baseUrl when health check passes', async () => {
  const orchestrator = new DevServerOrchestrator({
    spawnImpl: async () => ({ pid: 123, kill: async () => {} }),
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
  const lease = await orchestrator.start({
    kind: 'subprocess', command: 'node', args: ['server.js'], cwd: '/tmp', port: 5555, healthPath: '/',
  }, new AbortController().signal);

  assert.equal(lease.baseUrl, 'http://127.0.0.1:5555');
  await orchestrator.stop(lease);
});

test('throws when health check times out', async () => {
  const orchestrator = new DevServerOrchestrator({
    spawnImpl: async () => ({ pid: 123, kill: async () => {} }),
    fetchImpl: async () => ({ ok: false, status: 503 }),
    healthTimeoutMs: 50,
    healthPollMs: 10,
  });

  await assert.rejects(
    () => orchestrator.start({ kind: 'subprocess', command: 'node', args: [], cwd: '/tmp', port: 5556, healthPath: '/' }, new AbortController().signal),
    /did not become ready/,
  );
});
