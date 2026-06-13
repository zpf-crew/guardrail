import { spawn } from 'node:child_process';
import type { Evidence, RunOutcome } from '../../workbench.types.js';
import type { UiBrowserRunPlan } from '../../validation/workbench-validators.js';
import { screenshotEvidence } from './ui-browser-evidence.js';

export interface UiBrowserRunnerExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type UiBrowserRunnerExecutor = (
  args: string[],
  signal: AbortSignal,
) => Promise<UiBrowserRunnerExecuteResult>;

export interface UiBrowserRunnerResult {
  outcome: RunOutcome;
  durationMs: number;
  evidence: Evidence[];
  errorMessage?: string;
}

export interface UiBrowserRunnerRunArgs {
  url: string;
  route: string;
  plan: UiBrowserRunPlan;
  signal: AbortSignal;
  onCommand?: (args: string[], index: number, total: number, label?: string) => void;
}

interface RunnerCommand {
  args: string[];
  screenshotLabel?: string;
}

function commandSequence(baseUrl: string, route: string, plan: UiBrowserRunPlan): RunnerCommand[] {
  void route;
  return plan.actions.map(action => {
    switch (action.kind) {
      case 'open':
        return { args: ['open', new URL(action.path, baseUrl).toString()] };
      case 'waitForLoad':
        return { args: ['wait', '--load', action.state] };
      case 'snapshot':
        return { args: ['snapshot', '-i'] };
      case 'screenshot':
        return { args: ['screenshot'], screenshotLabel: action.label };
      case 'click':
        return { args: ['find', 'role', action.role, 'click', '--name', action.name] };
      case 'fill':
        return { args: ['find', 'label', action.label, 'fill', action.value] };
      case 'assertText':
        return { args: ['find', 'text', action.text] };
    }
  });
}

function defaultExecute(args: string[], signal: AbortSignal): Promise<UiBrowserRunnerExecuteResult> {
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

function evidenceFromScreenshot(stdout: string, label: string): Evidence {
  return screenshotEvidence(label, screenshotPathFromStdout(stdout));
}

function screenshotPathFromStdout(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  const savedMatch = trimmed.match(/Screenshot saved to\s+(.+)$/i);
  const value = savedMatch?.[1]?.trim() ?? trimmed;
  return value.length > 0 ? value : undefined;
}

function failureMessage(args: string[], result: UiBrowserRunnerExecuteResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
  return `agent-browser ${args.join(' ')} failed: ${detail}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }

  const data = error as { name?: unknown; code?: unknown; message?: unknown };
  return data.name === 'AbortError'
    || data.name === 'CanceledError'
    || data.name === 'CancelledError'
    || data.code === 'ABORT_ERR'
    || data.code === 'ERR_CANCELED'
    || (typeof data.message === 'string' && /\b(abort|aborted|cancelled|canceled)\b/i.test(data.message));
}

export class UiBrowserRunner {
  readonly #execute: UiBrowserRunnerExecutor;

  constructor(options: { execute?: UiBrowserRunnerExecutor } = {}) {
    this.#execute = options.execute ?? defaultExecute;
  }

  async run(args: UiBrowserRunnerRunArgs): Promise<UiBrowserRunnerResult> {
    const startedAt = Date.now();
    const evidence: Evidence[] = [];
    const commands = commandSequence(args.url, args.route, args.plan);

    for (const [index, command] of commands.entries()) {
      args.signal.throwIfAborted();
      args.onCommand?.(command.args, index, commands.length, command.screenshotLabel);
      let result: UiBrowserRunnerExecuteResult;
      try {
        result = await this.#execute(command.args, args.signal);
      } catch (error) {
        if (args.signal.aborted || isAbortLike(error)) {
          throw error;
        }
        return {
          outcome: 'Failed',
          durationMs: Date.now() - startedAt,
          evidence,
          errorMessage: `agent-browser ${command.args.join(' ')} failed: ${errorMessage(error)}`,
        };
      }

      if (command.screenshotLabel && result.exitCode === 0) {
        evidence.push(evidenceFromScreenshot(result.stdout, command.screenshotLabel));
      }

      if (result.exitCode !== 0) {
        return {
          outcome: 'Failed',
          durationMs: Date.now() - startedAt,
          evidence,
          errorMessage: failureMessage(command.args, result),
        };
      }
    }

    return {
      outcome: 'Passed',
      durationMs: Date.now() - startedAt,
      evidence,
    };
  }
}
