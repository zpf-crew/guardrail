import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_BROWSER_CORE_GUIDE_FALLBACK,
  buildAgentBrowserRunSkillContent,
  loadAgentBrowserCoreGuide,
} from './agent-browser-core-guide.js';

test('buildAgentBrowserRunSkillContent appends core guide once', () => {
  const skill = { name: 'test-run-ui-browser-agent', content: '# Run Skill' };
  const result = buildAgentBrowserRunSkillContent(skill, 'Core command guide');
  assert.match(result.content, /# Run Skill/);
  assert.match(result.content, /Core command guide/);
  assert.equal(result.name, 'test-run-ui-browser-agent');
});

test('loadAgentBrowserCoreGuide returns fallback when command fails', async () => {
  const result = await loadAgentBrowserCoreGuide({
    run: async () => ({ exitCode: 1, stdout: '', stderr: 'missing binary' }),
  });
  assert.equal(result, AGENT_BROWSER_CORE_GUIDE_FALLBACK);
});

test('loadAgentBrowserCoreGuide returns trimmed command guide when command succeeds', async () => {
  const result = await loadAgentBrowserCoreGuide({
    run: async () => ({
      exitCode: 0,
      stdout: [
        '---',
        'name: core',
        '---',
        '# agent-browser core',
        '',
        'Intro text that is less important for the runner.',
        '',
        '## The core loop',
        'Use the snapshot loop:',
        'agent-browser open <url>',
        'agent-browser snapshot -i',
        'agent-browser click @e3',
        '',
        '## Waiting (read this)',
        'agent-browser wait --load networkidle',
        'agent-browser click @e1 --new-tab',
        'agent-browser upload @e5 file.pdf',
        'agent-browser wait --fn "window.ready"',
        '',
        '## Auth Vault',
        'Auth Vault:',
        'agent-browser auth save <name>',
      ].join('\n'),
      stderr: '',
    }),
  });
  assert.match(result, /## The core loop/);
  assert.match(result, /agent-browser open <url>/);
  assert.match(result, /agent-browser snapshot -i/);
  assert.match(result, /agent-browser wait --load networkidle/);
  assert.doesNotMatch(result, /Auth Vault/);
  assert.doesNotMatch(result, /auth save/);
  assert.doesNotMatch(result, /--new-tab/);
  assert.doesNotMatch(result, /upload/);
  assert.doesNotMatch(result, /--fn/);
});
