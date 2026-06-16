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

test('runs build command before starting preview server', async () => {
  const events: string[] = [];
  const orchestrator = new DevServerOrchestrator({
    spawnImpl: async (command, args) => {
      events.push(`server:${command} ${args.join(' ')}`);
      return { pid: 123, kill: async () => {} };
    },
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });

  const lease = await orchestrator.start({
    kind: 'subprocess',
    command: 'npm',
    args: ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '5555'],
    cwd: '/tmp',
    port: 5555,
    healthPath: '/',
    buildCommand: 'node',
    buildArgs: ['-e', ''],
  }, new AbortController().signal, '/', event => {
    if (event.source === 'build' || event.source === 'server') {
      events.push(`${event.source}:${event.text.trim()}`);
    }
  });

  assert.equal(lease.baseUrl, 'http://127.0.0.1:5555');
  assert.deepEqual(events, [
    'build:$ node -e',
    'server:$ npm run preview -- --host 127.0.0.1 --port 5555',
    'server:npm run preview -- --host 127.0.0.1 --port 5555',
  ]);
  await orchestrator.stop(lease);
});

test('does not hang forever when subprocess cleanup does not resolve', async () => {
  const events: string[] = [];
  const orchestrator = new DevServerOrchestrator({
    spawnImpl: async () => ({ pid: 123, kill: async () => new Promise<void>(() => {}) }),
    fetchImpl: async () => ({ ok: true, status: 200 }),
    stopTimeoutMs: 10,
  });

  const lease = await orchestrator.start({
    kind: 'subprocess',
    command: 'npm',
    args: ['run', 'preview'],
    cwd: '/tmp',
    port: 5557,
    healthPath: '/',
  }, new AbortController().signal, '/', event => {
    events.push(event.text.trim());
  });

  await orchestrator.stop(lease);

  assert.equal(events.some(event => event.includes('cleanup timed out after 10ms')), true);
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
