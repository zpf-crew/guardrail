export interface QueueJob {
  id?: string;
  timeoutMs: number;
  onStatus: (status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout') => void;
  onError: (message: string) => void;
  run: (signal: AbortSignal) => Promise<void>;
}

const TIMEOUT_ERROR_GRACE_MS = 50;

interface PendingQueueJob {
  job: QueueJob;
  resolve: () => void;
  settled: boolean;
}

export class WorkbenchJobQueue {
  private readonly concurrency: number;
  private readonly maxPendingJobs: number;
  private readonly pending: PendingQueueJob[] = [];
  private readonly activeAbortControllers = new Map<string, AbortController>();
  private readonly activeJobs = new Map<string, QueueJob>();
  private readonly cancelledJobMessages = new Map<string, string>();
  private active = 0;

  constructor(options: { concurrency: number; maxPendingJobs?: number }) {
    this.concurrency = Math.max(1, options.concurrency);
    this.maxPendingJobs = Math.max(0, options.maxPendingJobs ?? Number.POSITIVE_INFINITY);
  }

  enqueue(job: QueueJob): Promise<void> {
    safeStatus(job, 'queued');
    if (this.pending.length >= this.maxPendingJobs) {
      safeStatus(job, 'failed');
      safeError(job, `Workbench job queue is full. Try again later. Max pending jobs: ${this.maxPendingJobs}.`);
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      this.pending.push({ job, resolve, settled: false });
      this.drain();
    });
  }

  cancel(jobId: string): boolean {
    const pendingIndex = this.pending.findIndex(pendingJob => pendingJob.job.id === jobId);
    if (pendingIndex !== -1) {
      const [pendingJob] = this.pending.splice(pendingIndex, 1);
      if (!pendingJob) return false;
      safeStatus(pendingJob.job, 'failed');
      safeError(pendingJob.job, 'Job stopped by user.');
      this.resolvePending(pendingJob);
      return true;
    }

    const abortController = this.activeAbortControllers.get(jobId);
    if (!abortController) return false;
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      this.cancelledJobMessages.set(jobId, 'Job stopped by user.');
      safeStatus(activeJob, 'failed');
      safeError(activeJob, 'Job stopped by user.');
    }
    abortController.abort(new Error('Job stopped by user.'));
    return true;
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const pendingJob = this.pending.shift();
      if (!pendingJob) return;

      this.active += 1;
      void this.run(pendingJob).catch(() => {
        this.settle(pendingJob);
      });
    }
  }

  private async run(pendingJob: PendingQueueJob): Promise<void> {
    const { job } = pendingJob;
    const abortController = new AbortController();
    let timedOut = false;
    let emittedError = false;
    let timeoutTimer: NodeJS.Timeout | undefined;

    const emitError = (message: string): void => {
      emittedError = true;
      safeError(job, message);
    };

    safeStatus(job, 'running');
    if (job.id) {
      this.activeAbortControllers.set(job.id, abortController);
      this.activeJobs.set(job.id, job);
    }

    try {
      const runPromise = job.run(abortController.signal);

      if (job.timeoutMs <= 0) {
        await runPromise;
        safeStatus(job, 'succeeded');
        this.settle(pendingJob);
        return;
      }

      const result = await Promise.race([
        runPromise.then(
          () => ({ type: 'completed' as const }),
          error => ({ type: 'failed' as const, error }),
        ),
        new Promise<{ type: 'timeout' }>(resolve => {
          timeoutTimer = setTimeout(() => resolve({ type: 'timeout' }), job.timeoutMs);
        }),
      ]);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (result.type === 'completed') {
        safeStatus(job, 'succeeded');
        this.settle(pendingJob);
        return;
      }

      if (result.type === 'failed') {
        const cancelledMessage = job.id ? this.cancelledJobMessages.get(job.id) : undefined;
        if (!cancelledMessage) {
          safeStatus(job, 'failed');
          emitError(errorMessage(result.error));
        }
        this.settle(pendingJob);
        return;
      }

      timedOut = true;
      abortController.abort();
      safeStatus(job, 'timeout');

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

      this.settle(pendingJob);
    } catch (error) {
      const cancelledMessage = job.id ? this.cancelledJobMessages.get(job.id) : undefined;
      if (!cancelledMessage) {
        if (!timedOut) safeStatus(job, 'failed');
        emitError(errorMessage(error));
      }
      this.settle(pendingJob);
    } finally {
      if (job.id) {
        this.activeAbortControllers.delete(job.id);
        this.activeJobs.delete(job.id);
        this.cancelledJobMessages.delete(job.id);
      }
      if (timeoutTimer) clearTimeout(timeoutTimer);
      this.settle(pendingJob);
    }
  }

  private settle(pendingJob: PendingQueueJob): void {
    if (pendingJob.settled) return;

    pendingJob.settled = true;
    this.active -= 1;
    pendingJob.resolve();
    this.drain();
  }

  private resolvePending(pendingJob: PendingQueueJob): void {
    if (pendingJob.settled) return;

    pendingJob.settled = true;
    pendingJob.resolve();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeStatus(
  job: QueueJob,
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout',
): void {
  try {
    job.onStatus(status);
  } catch {
    // Callback failures must not compromise queue liveness.
  }
}

function safeError(job: QueueJob, message: string): void {
  try {
    job.onError(message);
  } catch {
    // Callback failures must not compromise queue liveness.
  }
}
