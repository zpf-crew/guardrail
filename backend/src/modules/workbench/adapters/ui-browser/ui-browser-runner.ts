import { spawn } from 'node:child_process';
import type { Evidence, RunOutcome } from '../../workbench.types.js';
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
  signal: AbortSignal;
  onCommand?: (args: string[], index: number, total: number) => void;
}

const commandSequence = (url: string): string[][] => [
  ['open', url],
  ['wait', '--load', 'networkidle'],
  ['snapshot', '-i'],
  ['find', 'role', 'button', 'click', '--name', 'Continue'],
  ['wait', '--load', 'networkidle'],
  ['screenshot'],
  ['close'],
];

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

function evidenceFromScreenshot(stdout: string): Evidence {
  const href = stdout.trim();
  return screenshotEvidence('Onboarding screenshot', href.length > 0 ? href : undefined);
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
    const commands = commandSequence(args.url);

    for (const [index, commandArgs] of commands.entries()) {
      args.signal.throwIfAborted();
      args.onCommand?.(commandArgs, index, commands.length);
      let result: UiBrowserRunnerExecuteResult;
      try {
        result = await this.#execute(commandArgs, args.signal);
      } catch (error) {
        if (args.signal.aborted || isAbortLike(error)) {
          throw error;
        }
        return {
          outcome: 'Failed',
          durationMs: Date.now() - startedAt,
          evidence,
          errorMessage: `agent-browser ${commandArgs.join(' ')} failed: ${errorMessage(error)}`,
        };
      }

      if (commandArgs[0] === 'screenshot' && result.exitCode === 0) {
        evidence.push(evidenceFromScreenshot(result.stdout));
      }

      if (result.exitCode !== 0) {
        return {
          outcome: 'Failed',
          durationMs: Date.now() - startedAt,
          evidence,
          errorMessage: failureMessage(commandArgs, result),
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
