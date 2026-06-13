import test from 'node:test';
import assert from 'node:assert/strict';
import { UiBrowserRunner } from './ui-browser-runner.js';

test('runner executes onboarding commands and maps screenshots to evidence', async () => {
  const commands: string[][] = [];
  const runner = new UiBrowserRunner({
    execute: async args => {
      commands.push(args);
      if (args[0] === 'screenshot') {
        return { exitCode: 0, stdout: '✓ Screenshot saved to /tmp/onboarding.png\n', stderr: '' };
      }
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.run({ url: 'http://localhost:5173/onboarding', signal: new AbortController().signal });

  assert.deepEqual(commands[0], ['open', 'http://localhost:5173/onboarding']);
  assert.ok(commands.some(args => args[0] === 'snapshot'));
  assert.equal(result.outcome, 'Passed');
  assert.equal(result.evidence[0]?.kind, 'screenshot');
  assert.equal(result.evidence[0]?.href, '/tmp/onboarding.png');
});

test('runner returns failed result when executor throws a normal error', async () => {
  const runner = new UiBrowserRunner({
    execute: async args => {
      if (args[0] === 'close') {
        throw new Error('agent-browser unavailable');
      }
      if (args[0] === 'screenshot') return { exitCode: 0, stdout: '/tmp/onboarding.png', stderr: '' };
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  const result = await runner.run({ url: 'http://localhost:5173/onboarding', signal: new AbortController().signal });

  assert.equal(result.outcome, 'Failed');
  assert.equal(result.evidence[0]?.kind, 'screenshot');
  assert.match(result.errorMessage ?? '', /agent-browser unavailable/);
});

test('runner propagates abort executor rejection', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const runner = new UiBrowserRunner({
    execute: async () => {
      throw abortError;
    },
  });

  await assert.rejects(
    runner.run({ url: 'http://localhost:5173/onboarding', signal: new AbortController().signal }),
    abortError,
  );
});
