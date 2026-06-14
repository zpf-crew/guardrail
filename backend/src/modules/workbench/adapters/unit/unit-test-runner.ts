import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { shouldFallbackToFullTestCommand, type UnitTestCommand } from './unit-test-command-resolver.js';
import type { RunOutcome } from '../../workbench.types.js';

const exec = promisify(execCallback);

export interface UnitTestRunnerResult {
  command: string;
  outcome: RunOutcome;
  durationMs: number;
  output: string;
  usedFallback: boolean;
}

async function runCommand(command: string, cwd: string, signal: AbortSignal): Promise<{ ok: boolean; output: string }> {
  try {
    const result = await exec(command, {
      cwd,
      signal,
      timeout: 240_000,
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, output: `${result.stdout}${result.stderr}` };
  } catch (error) {
    const data = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: `${data.stdout ?? ''}${data.stderr ?? ''}${data.message ? `\n${data.message}` : ''}`.trim() };
  }
}

export async function runUnitTestCommand(
  resolved: UnitTestCommand,
  signal: AbortSignal,
): Promise<UnitTestRunnerResult> {
  const startedAt = Date.now();
  const focused = await runCommand(resolved.focusedCommand, resolved.cwd, signal);
  if (focused.ok) {
    return {
      command: resolved.focusedCommand,
      outcome: 'Passed',
      durationMs: Date.now() - startedAt,
      output: focused.output,
      usedFallback: false,
    };
  }

  if (!shouldFallbackToFullTestCommand(focused.output)) {
    return {
      command: resolved.focusedCommand,
      outcome: 'Failed',
      durationMs: Date.now() - startedAt,
      output: focused.output,
      usedFallback: false,
    };
  }

  const full = await runCommand(resolved.fullCommand, resolved.cwd, signal);
  return {
    command: resolved.fullCommand,
    outcome: full.ok ? 'Passed' : 'Failed',
    durationMs: Date.now() - startedAt,
    output: full.output,
    usedFallback: true,
  };
}
