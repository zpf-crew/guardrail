import { spawn as nodeSpawn } from 'node:child_process';
import { dirname } from 'node:path';
import type { DevServerTarget } from './dev-server-resolver.js';

export interface DevServerLease {
  baseUrl: string;
  route: string;
  stop: () => Promise<void>;
}

export interface SpawnedProcess {
  pid: number;
  output?: () => ProcessOutput;
  kill: (signal?: NodeJS.Signals) => Promise<void>;
}

export interface ProcessOutput {
  stdout: string;
  stderr: string;
}

export interface DevServerLogEvent {
  source: 'install' | 'build' | 'server' | 'docker';
  stream: 'stdout' | 'stderr';
  text: string;
}

export type SpawnImpl = (
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; onOutput?: (event: DevServerLogEvent) => void; source?: DevServerLogEvent['source'] },
) => Promise<SpawnedProcess>;

export type FetchImpl = (
  input: string | URL,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number }>;

export interface DevServerOrchestratorOptions {
  spawnImpl?: SpawnImpl;
  fetchImpl?: FetchImpl;
  healthTimeoutMs?: number;
  healthPollMs?: number;
  stopTimeoutMs?: number;
}

const DEFAULT_HEALTH_TIMEOUT_MS = Number(process.env.WORKBENCH_DEV_SERVER_TIMEOUT_MS) || 60_000;
const DEFAULT_HEALTH_POLL_MS = 500;
const DEFAULT_STOP_TIMEOUT_MS = Number(process.env.WORKBENCH_DEV_SERVER_STOP_TIMEOUT_MS) || 6_000;
const DEFAULT_KILL_GRACE_MS = 5_000;
const MAX_CAPTURED_OUTPUT_CHARS = 8_000;

function appendBounded(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length > MAX_CAPTURED_OUTPUT_CHARS ? next.slice(-MAX_CAPTURED_OUTPUT_CHARS) : next;
}

function excerpt(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 2_000 ? `${trimmed.slice(0, 2_000)}…` : trimmed;
}

function outputDetail(output: ProcessOutput | undefined): string {
  if (!output) return '';
  const detail = excerpt(output.stderr || output.stdout);
  return detail ? ` Output: ${detail}` : '';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function waitForCleanup(
  cleanup: () => Promise<void>,
  timeoutMs: number,
): Promise<'completed' | 'timeout'> {
  let timer: NodeJS.Timeout | undefined;
  const completion = cleanup().then(
    () => ({ type: 'completed' as const }),
    error => ({ type: 'failed' as const, error }),
  );
  const timeout = new Promise<{ type: 'timeout' }>(resolve => {
    timer = setTimeout(() => resolve({ type: 'timeout' }), timeoutMs);
  });

  const result = await Promise.race([completion, timeout]);
  if (timer) clearTimeout(timer);
  if (result.type === 'failed') throw result.error;
  return result.type === 'timeout' ? 'timeout' : 'completed';
}

function defaultSpawnImpl(
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; onOutput?: (event: DevServerLogEvent) => void; source?: DevServerLogEvent['source'] },
): Promise<SpawnedProcess> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'pipe',
    });

    child.on('error', reject);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => {
      const text = String(chunk);
      stdout = appendBounded(stdout, text);
      options.onOutput?.({ source: options.source ?? 'server', stream: 'stdout', text });
    });
    child.stderr?.on('data', chunk => {
      const text = String(chunk);
      stderr = appendBounded(stderr, text);
      options.onOutput?.({ source: options.source ?? 'server', stream: 'stderr', text });
    });

    const spawned: SpawnedProcess = {
      pid: child.pid ?? 0,
      output: () => ({ stdout, stderr }),
      kill: async (signal = 'SIGTERM') => {
        if (child.exitCode !== null || child.signalCode !== null) return;

        await new Promise<void>(killResolve => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(forceTimer);
            clearTimeout(fallbackTimer);
            killResolve();
          };
          const forceTimer = setTimeout(() => {
            if (child.exitCode === null) child.kill('SIGKILL');
          }, DEFAULT_KILL_GRACE_MS);
          const fallbackTimer = setTimeout(done, DEFAULT_KILL_GRACE_MS + 1_000);
          child.once('close', done);
          const signaled = child.kill(signal);
          if (!signaled && child.exitCode !== null) done();
        });
      },
    };

    if (child.pid !== undefined) {
      resolve(spawned);
      return;
    }

    child.once('spawn', () => {
      spawned.pid = child.pid ?? 0;
      resolve(spawned);
    });
  });
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; signal: AbortSignal; onOutput?: (event: DevServerLogEvent) => void; source: DevServerLogEvent['source'] },
): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'pipe',
      signal: options.signal,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', chunk => {
      const text = String(chunk);
      stdout = appendBounded(stdout, text);
      options.onOutput?.({ source: options.source, stream: 'stdout', text });
    });
    child.stderr?.on('data', chunk => {
      const text = String(chunk);
      stderr = appendBounded(stderr, text);
      options.onOutput?.({ source: options.source, stream: 'stderr', text });
    });
    child.on('error', reject);
    child.on('close', code => {
      const output = { stdout, stderr };
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(' ')} failed with exit ${code ?? 1}.${outputDetail(output)}`));
    });
  });
}

export class DevServerOrchestrator {
  readonly #spawnImpl: SpawnImpl;
  readonly #fetchImpl: FetchImpl;
  readonly #healthTimeoutMs: number;
  readonly #healthPollMs: number;
  readonly #stopTimeoutMs: number;

  constructor(options: DevServerOrchestratorOptions = {}) {
    this.#spawnImpl = options.spawnImpl ?? defaultSpawnImpl;
    this.#fetchImpl = options.fetchImpl ?? (async (url, init) => {
      const response = await fetch(url, init);
      return { ok: response.ok, status: response.status };
    });
    this.#healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
    this.#healthPollMs = options.healthPollMs ?? DEFAULT_HEALTH_POLL_MS;
    this.#stopTimeoutMs = options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
  }

  async start(
    target: DevServerTarget,
    signal: AbortSignal,
    route = '/',
    onLog?: (event: DevServerLogEvent) => void,
  ): Promise<DevServerLease> {
    const baseUrl = `http://127.0.0.1:${target.port}`;
    const healthUrl = `${baseUrl}${target.healthPath}`;
    let cleanup: (() => Promise<void>) | null = null;
    let stopped = false;

    const runCleanup = async () => {
      if (stopped) return;
      stopped = true;
      if (!cleanup) return;
      const result = await waitForCleanup(cleanup, this.#stopTimeoutMs);
      if (result === 'timeout') {
        onLog?.({
          source: target.kind === 'docker' ? 'docker' : 'server',
          stream: 'stderr',
          text: `Dev server cleanup timed out after ${this.#stopTimeoutMs}ms\n`,
        });
      }
    };

    const onAbort = () => {
      void runCleanup();
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      if (target.kind === 'subprocess') {
        if (target.installCommand && target.installArgs) {
          onLog?.({ source: 'install', stream: 'stdout', text: `$ ${target.installCommand} ${target.installArgs.join(' ')}\n` });
          await runCommand(target.installCommand, target.installArgs, {
            cwd: target.cwd,
            env: {},
            signal,
            onOutput: onLog,
            source: 'install',
          });
        }
        if (target.buildCommand && target.buildArgs) {
          onLog?.({ source: 'build', stream: 'stdout', text: `$ ${target.buildCommand} ${target.buildArgs.join(' ')}\n` });
          await runCommand(target.buildCommand, target.buildArgs, {
            cwd: target.cwd,
            env: {},
            signal,
            onOutput: onLog,
            source: 'build',
          });
        }
        onLog?.({ source: 'server', stream: 'stdout', text: `$ ${target.command} ${target.args.join(' ')}\n` });
        const process = await this.#spawnImpl(target.command, target.args, {
          cwd: target.cwd,
          env: {
            PORT: String(target.port),
            HOST: '127.0.0.1',
          },
          onOutput: onLog,
          source: 'server',
        });
        cleanup = async () => {
          await process.kill('SIGTERM');
        };
        try {
          await this.#waitForHealth(healthUrl, signal);
        } catch (error) {
          throw new Error(`${error instanceof Error ? error.message : String(error)}.${outputDetail(process.output?.())}`);
        }
      } else {
        await this.#spawnImpl('docker', [
          'compose',
          '-f',
          target.composeFile,
          '-p',
          target.projectName,
          'up',
          '-d',
          target.service,
        ], {
          cwd: dirname(target.composeFile),
          env: {},
          onOutput: onLog,
          source: 'docker',
        });
        cleanup = async () => {
          await this.#spawnImpl('docker', [
            'compose',
            '-f',
            target.composeFile,
            '-p',
            target.projectName,
            'down',
          ], {
            cwd: dirname(target.composeFile),
            env: {},
            onOutput: onLog,
            source: 'docker',
          });
        };
        await this.#waitForHealth(healthUrl, signal);
      }

      return {
        baseUrl,
        route,
        stop: runCleanup,
      };
    } catch (error) {
      await runCleanup();
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  async stop(lease: DevServerLease): Promise<void> {
    await lease.stop();
  }

  async #waitForHealth(healthUrl: string, signal: AbortSignal): Promise<void> {
    const deadline = Date.now() + this.#healthTimeoutMs;

    while (Date.now() < deadline) {
      signal.throwIfAborted();

      try {
        const response = await this.#fetchImpl(healthUrl);
        if (response.ok && response.status === 200) return;
      } catch {
        // retry until timeout
      }

      await sleep(this.#healthPollMs, signal);
    }

    throw new Error(`Dev server did not become ready within ${this.#healthTimeoutMs}ms`);
  }
}
