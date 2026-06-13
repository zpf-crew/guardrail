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
  kill: (signal?: NodeJS.Signals) => Promise<void>;
}

export type SpawnImpl = (
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string> },
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
}

const DEFAULT_HEALTH_TIMEOUT_MS = Number(process.env.WORKBENCH_DEV_SERVER_TIMEOUT_MS) || 60_000;
const DEFAULT_HEALTH_POLL_MS = 500;

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

function defaultSpawnImpl(
  command: string,
  args: string[],
  options: { cwd: string; env: Record<string, string> },
): Promise<SpawnedProcess> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'pipe',
    });

    child.on('error', reject);

    const spawned: SpawnedProcess = {
      pid: child.pid ?? 0,
      kill: async (signal = 'SIGTERM') => {
        if (child.exitCode !== null) return;

        await new Promise<void>(killResolve => {
          const forceTimer = setTimeout(() => {
            if (child.exitCode === null) child.kill('SIGKILL');
          }, 5_000);
          child.once('close', () => {
            clearTimeout(forceTimer);
            killResolve();
          });
          child.kill(signal);
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

export class DevServerOrchestrator {
  readonly #spawnImpl: SpawnImpl;
  readonly #fetchImpl: FetchImpl;
  readonly #healthTimeoutMs: number;
  readonly #healthPollMs: number;

  constructor(options: DevServerOrchestratorOptions = {}) {
    this.#spawnImpl = options.spawnImpl ?? defaultSpawnImpl;
    this.#fetchImpl = options.fetchImpl ?? (async (url, init) => {
      const response = await fetch(url, init);
      return { ok: response.ok, status: response.status };
    });
    this.#healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
    this.#healthPollMs = options.healthPollMs ?? DEFAULT_HEALTH_POLL_MS;
  }

  async start(target: DevServerTarget, signal: AbortSignal, route = '/'): Promise<DevServerLease> {
    const baseUrl = `http://127.0.0.1:${target.port}`;
    const healthUrl = `${baseUrl}${target.healthPath}`;
    let cleanup: (() => Promise<void>) | null = null;
    let stopped = false;

    const runCleanup = async () => {
      if (stopped) return;
      stopped = true;
      await cleanup?.();
    };

    const onAbort = () => {
      void runCleanup();
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      if (target.kind === 'subprocess') {
        const process = await this.#spawnImpl(target.command, target.args, {
          cwd: target.cwd,
          env: {
            PORT: String(target.port),
            HOST: '127.0.0.1',
          },
        });
        cleanup = async () => {
          await process.kill('SIGTERM');
        };
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
          });
        };
      }

      await this.#waitForHealth(healthUrl, signal);

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
