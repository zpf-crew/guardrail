import { env } from '../../config/env.js';
import { ModelClientError } from './model-errors.js';

const MAX_CONCURRENT_MODEL_CALLS = 5;

interface PendingAcquire {
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

let activeCalls = 0;
const pending: PendingAcquire[] = [];

export async function withModelCallLimit<T>(
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const release = await acquireModelCallSlot(signal);
  try {
    return await operation();
  } finally {
    release();
  }
}

function acquireModelCallSlot(signal: AbortSignal | undefined): Promise<() => void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  }

  if (activeCalls < MAX_CONCURRENT_MODEL_CALLS) {
    activeCalls += 1;
    return Promise.resolve(releaseModelCallSlot);
  }
  if (pending.length >= env.MODEL_MAX_PENDING_CALLS) {
    return Promise.reject(new ModelClientError({
      code: 'model_queue_full',
      message: `LLM request queue is full. Try again later. Max pending calls: ${env.MODEL_MAX_PENDING_CALLS}.`,
      retryable: true,
    }));
  }

  return new Promise((resolve, reject) => {
    const waiter: PendingAcquire = { resolve, reject, signal };
    waiter.onAbort = () => {
      const index = pending.indexOf(waiter);
      if (index !== -1) pending.splice(index, 1);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', waiter.onAbort, { once: true });
    pending.push(waiter);
  });
}

function releaseModelCallSlot(): void {
  activeCalls = Math.max(0, activeCalls - 1);
  drainModelCallQueue();
}

function drainModelCallQueue(): void {
  while (activeCalls < MAX_CONCURRENT_MODEL_CALLS) {
    const waiter = pending.shift();
    if (!waiter) return;

    waiter.signal?.removeEventListener('abort', waiter.onAbort ?? (() => {}));
    if (waiter.signal?.aborted) {
      waiter.reject(waiter.signal.reason ?? new DOMException('Aborted', 'AbortError'));
      continue;
    }

    activeCalls += 1;
    waiter.resolve(releaseModelCallSlot);
  }
}
