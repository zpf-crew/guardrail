export interface QueueJob {
  timeoutMs: number;
  onStatus: (status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout') => void;
  onError: (message: string) => void;
  run: (signal: AbortSignal) => Promise<void>;
}

const TIMEOUT_ERROR_GRACE_MS = 50;

interface PendingQueueJob {
  job: QueueJob;
  resolve: () => void;
}

export class WorkbenchJobQueue {
  private readonly concurrency: number;
  private readonly pending: PendingQueueJob[] = [];
  private active = 0;

  constructor(options: { concurrency: number }) {
    this.concurrency = Math.max(1, options.concurrency);
  }

  enqueue(job: QueueJob): Promise<void> {
    job.onStatus('queued');

    return new Promise<void>(resolve => {
      this.pending.push({ job, resolve });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const pendingJob = this.pending.shift();
      if (!pendingJob) return;

      this.active += 1;
      void this.run(pendingJob);
    }
  }

  private async run({ job, resolve }: PendingQueueJob): Promise<void> {
    const abortController = new AbortController();
    let timedOut = false;
    let settled = false;
    let emittedError = false;

    const settle = (): void => {
      if (settled) return;
      settled = true;
      this.active -= 1;
      resolve();
      this.drain();
    };

    const emitError = (message: string): void => {
      emittedError = true;
      job.onError(message);
    };

    job.onStatus('running');

    try {
      const runPromise = job.run(abortController.signal);

      if (job.timeoutMs <= 0) {
        await runPromise;
        job.onStatus('succeeded');
        resolve();
        return;
      }

      const result = await Promise.race([
        runPromise.then(
          () => ({ type: 'completed' as const }),
          error => ({ type: 'failed' as const, error }),
        ),
        delay(job.timeoutMs).then(() => ({ type: 'timeout' as const })),
      ]);

      if (result.type === 'completed') {
        job.onStatus('succeeded');
        settle();
        return;
      }

      if (result.type === 'failed') {
        job.onStatus('failed');
        emitError(errorMessage(result.error));
        settle();
        return;
      }

      timedOut = true;
      abortController.abort();
      job.onStatus('timeout');

      runPromise.catch(error => {
        emitError(errorMessage(error));
      });

      const firstAbortError = await Promise.race([
        runPromise.then(
          () => undefined,
          error => error,
        ),
        delay(TIMEOUT_ERROR_GRACE_MS).then(() => undefined),
      ]);

      if (firstAbortError === undefined && !emittedError) {
        emitError(`Job timed out after ${job.timeoutMs}ms and was aborted`);
      }

      settle();
    } catch (error) {
      if (!timedOut) job.onStatus('failed');
      emitError(errorMessage(error));
      settle();
    } finally {
      settle();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
