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
      stdout: 'Intro\nCore Commands:\n  open <url>\n  click <sel>\nAuth Vault:\n  auth save <name>',
      stderr: '',
    }),
  });
  assert.match(result, /Core Commands:/);
  assert.match(result, /open <url>/);
  assert.doesNotMatch(result, /auth save/);
});
