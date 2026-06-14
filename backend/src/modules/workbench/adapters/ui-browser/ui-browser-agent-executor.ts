import { spawn } from 'node:child_process';
import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';
import {
  agentBrowserCommandArgs,
  isAgentBrowserCommandAction,
  isExecutableAgentBrowserCommand,
} from './agent-browser-command-policy.js';

export interface AgentExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type AgentExecutor = (args: string[], signal: AbortSignal) => Promise<AgentExecuteResult>;

export function agentCommandArgs(baseUrl: string, action: UiBrowserAgentAction): string[] | null {
  if (!isAgentBrowserCommandAction(action)) return null;
  return agentBrowserCommandArgs(baseUrl, action);
}

export function isSnapshotAction(action: UiBrowserAgentAction): boolean {
  return isExecutableAgentBrowserCommand(action);
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
