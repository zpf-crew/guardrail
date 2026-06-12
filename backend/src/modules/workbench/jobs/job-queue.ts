export interface QueueJob {
  timeoutMs: number;
  onStatus: (status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout') => void;
  onError: (message: string) => void;
  run: (signal: AbortSignal) => Promise<void>;
}

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
    let timeout: NodeJS.Timeout | undefined;

    if (job.timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        abortController.abort();
        job.onStatus('timeout');
      }, job.timeoutMs);
    }

    job.onStatus('running');

    try {
      await job.run(abortController.signal);
      if (!timedOut) job.onStatus('succeeded');
      resolve();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!timedOut) job.onStatus('failed');
      job.onError(message);
      resolve();
    } finally {
      if (timeout) clearTimeout(timeout);
      this.active -= 1;
      this.drain();
    }
  }
}
