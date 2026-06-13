import type { WorkbenchJobEvent } from '../workbench.types.js';

export type JobEventListener = (event: WorkbenchJobEvent) => void;

export class WorkbenchJobEventBus {
  private readonly listeners = new Map<string, Set<JobEventListener>>();

  subscribe(key: string, listener: JobEventListener): () => void {
    const set = this.listeners.get(key) ?? new Set<JobEventListener>();
    set.add(listener);
    this.listeners.set(key, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(key);
    };
  }

  publish(key: string, event: WorkbenchJobEvent): void {
    this.listeners.get(key)?.forEach(listener => {
      try {
        listener(event);
      } catch {
        // Listener failures must not block other subscribers or job progress.
      }
    });
  }
}

export function formatSse(event: WorkbenchJobEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
