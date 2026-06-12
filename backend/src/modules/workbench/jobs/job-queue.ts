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
        resolve();
        return;
      }

      if (result.type === 'failed') {
        job.onStatus('failed');
        job.onError(errorMessage(result.error));
        resolve();
        return;
      }

      timedOut = true;
      abortController.abort();
      job.onStatus('timeout');

      const abortError = await Promise.race([
        runPromise.then(
          () => undefined,
          error => error,
        ),
        delay(TIMEOUT_ERROR_GRACE_MS).then(() => undefined),
      ]);

      job.onError(
        abortError === undefined
          ? `Job timed out after ${job.timeoutMs}ms and was aborted`
          : errorMessage(abortError),
      );
      resolve();
    } catch (error) {
      if (!timedOut) job.onStatus('failed');
      job.onError(errorMessage(error));
      resolve();
    } finally {
      this.active -= 1;
      this.drain();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
