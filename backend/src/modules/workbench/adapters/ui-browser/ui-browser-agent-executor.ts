import { spawn } from 'node:child_process';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

export interface AgentExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type AgentExecutor = (args: string[], signal: AbortSignal) => Promise<AgentExecuteResult>;

export function agentCommandArgs(baseUrl: string, action: UiBrowserAgentAction): string[] | null {
  switch (action.kind) {
    case 'open':
      return ['open', new URL(action.path, baseUrl).toString()];
    case 'wait':
      return ['wait', '--load', action.load];
    case 'click':
      return ['click', action.ref];
    case 'fill':
      return ['fill', action.ref, action.value];
    case 'screenshot':
      return ['screenshot'];
    case 'stepComplete':
    case 'assertThen':
    case 'stepFailed':
    case 'scenarioComplete':
      return null;
  }
}

export function isSnapshotAction(action: UiBrowserAgentAction): boolean {
  return action.kind === 'click' || action.kind === 'fill';
}

export async function executeAgentAction(
  baseUrl: string,
  action: UiBrowserAgentAction,
  execute: AgentExecutor,
  signal: AbortSignal,
): Promise<AgentExecuteResult | null> {
  const args = agentCommandArgs(baseUrl, action);
  if (!args) return null;
  return execute(args, signal);
}

export function defaultAgentExecutor(args: string[], signal: AbortSignal): Promise<AgentExecuteResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('agent-browser', args, { signal });
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
  });
}

export async function captureSnapshot(
  execute: AgentExecutor,
  signal: AbortSignal,
): Promise<AgentExecuteResult> {
  return execute(['snapshot', '-i'], signal);
}
