import { spawn } from 'node:child_process';
import type { SkillContract } from '../../skills/skill-contract-loader.js';

export interface CommandRunner {
  run(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export const AGENT_BROWSER_CORE_GUIDE_FALLBACK = [
  'Core Commands: Guardrail allowed agent-browser subset',
  'Return allowed commands as an agentBrowserCommand envelope, for example:',
  '- open: { "kind": "agentBrowserCommand", "command": "open", "args": ["/products"], "reason": "Open the page under test." }',
  '- snapshot: { "kind": "agentBrowserCommand", "command": "snapshot", "args": ["-i"], "reason": "Inspect the current page." }',
  '- click: { "kind": "agentBrowserCommand", "command": "click", "args": ["@e4"], "reason": "Click the visible control." }',
  '- dblclick: { "kind": "agentBrowserCommand", "command": "dblclick", "args": ["@e4"], "reason": "Double-click the visible control." }',
  '- hover: { "kind": "agentBrowserCommand", "command": "hover", "args": ["@e4"], "reason": "Reveal the menu." }',
  '- focus: { "kind": "agentBrowserCommand", "command": "focus", "args": ["@e4"], "reason": "Prepare the field." }',
  '- fill: { "kind": "agentBrowserCommand", "command": "fill", "args": ["@e4", "buyer@example.com"], "reason": "Enter the email." }',
  '- type: { "kind": "agentBrowserCommand", "command": "type", "args": ["@e4", "shoes"], "reason": "Search for products." }',
  '- press: { "kind": "agentBrowserCommand", "command": "press", "args": ["Enter"], "reason": "Submit keyboard input." }',
  '- keyboard type: { "kind": "agentBrowserCommand", "command": "keyboard", "args": ["type", "hello"], "reason": "Type into the focused element." }',
  '- keyboard inserttext: { "kind": "agentBrowserCommand", "command": "keyboard", "args": ["inserttext", "hello"], "reason": "Insert text into the focused element." }',
  '- scroll: { "kind": "agentBrowserCommand", "command": "scroll", "args": ["down", "500"], "reason": "Move down the page." }',
  '- scrollintoview: { "kind": "agentBrowserCommand", "command": "scrollintoview", "args": ["@e4"], "reason": "Bring checkout into view." }',
  '- wait load: { "kind": "agentBrowserCommand", "command": "wait", "args": ["--load", "networkidle"], "reason": "Wait after navigation." }',
  '- wait text: { "kind": "agentBrowserCommand", "command": "wait", "args": ["--text", "Success"], "reason": "Wait for success text." }',
  '- get text: { "kind": "agentBrowserCommand", "command": "get", "args": ["text", "@e4"], "reason": "Read visible status text." }',
  '- get value: { "kind": "agentBrowserCommand", "command": "get", "args": ["value", "@e4"], "reason": "Read input value." }',
  '- get url: { "kind": "agentBrowserCommand", "command": "get", "args": ["url"], "reason": "Verify current route." }',
  '- is visible: { "kind": "agentBrowserCommand", "command": "is", "args": ["visible", "@e4"], "reason": "Check if the toast is visible." }',
  '- find role button click --name Add to Cart: { "kind": "agentBrowserCommand", "command": "find", "args": ["role", "button", "click", "--name", "Add to Cart"], "reason": "Click the Add to Cart button." }',
  '- screenshot: { "kind": "agentBrowserCommand", "command": "screenshot", "args": [], "reason": "Capture visual evidence." }',
].join('\n');

const defaultCommandRunner: CommandRunner = {
  run: args => new Promise((resolve, reject) => {
    const child = spawn('agent-browser', args);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)));
    child.on('error', reject);
    child.on('close', code => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  }),
};

let defaultCoreGuidePromise: Promise<string> | null = null;

export function buildAgentBrowserRunSkillContent(
  skill: SkillContract,
  coreGuide: string,
): SkillContract {
  const guideHeader = '## Version-matched agent-browser CLI guide';
  if (skill.content.includes(guideHeader)) {
    return skill;
  }

  return {
    ...skill,
    content: [
      skill.content.trimEnd(),
      '',
      guideHeader,
      '',
      coreGuide.trim(),
      '',
      '## Guardrail safety reminder',
      '',
      'Return only allowed `agentBrowserCommand` envelopes or semantic verdicts. Do not request blocked commands, unrestricted shell access, auth/session/setup commands, file transfer commands, or external navigation outside the managed dev server origin.',
    ].join('\n'),
  };
}

export async function loadAgentBrowserCoreGuide(
  runner: CommandRunner = defaultCommandRunner,
): Promise<string> {
  if (runner === defaultCommandRunner) {
    defaultCoreGuidePromise ??= loadGuide(runner);
    return defaultCoreGuidePromise;
  }

  return loadGuide(runner);
}

async function loadGuide(runner: CommandRunner): Promise<string> {
  try {
    const result = await runner.run(['skills', 'get', 'core']);
    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return AGENT_BROWSER_CORE_GUIDE_FALLBACK;
    }

    return trimGuide(result.stdout);
  } catch {
    return AGENT_BROWSER_CORE_GUIDE_FALLBACK;
  }
}

function trimGuide(rawGuide: string): string {
  const startMatch = /Core Commands:/i.exec(rawGuide);
  if (!startMatch) {
    return AGENT_BROWSER_CORE_GUIDE_FALLBACK;
  }

  return AGENT_BROWSER_CORE_GUIDE_FALLBACK;
}
