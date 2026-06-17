export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  now?: () => number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  readonly #failureThreshold: number;
  readonly #resetTimeoutMs: number;
  readonly #now: () => number;
  #failures = 0;
  #openUntil = 0;
  #state: CircuitState = 'closed';

  constructor(options: CircuitBreakerOptions = {}) {
    this.#failureThreshold = options.failureThreshold ?? 5;
    this.#resetTimeoutMs = options.resetTimeoutMs ?? 60_000;
    this.#now = options.now ?? Date.now;
  }

  isOpen(): boolean {
    const now = this.#now();
    if (this.#state === 'open' && now >= this.#openUntil) {
      this.#state = 'half-open';
      return false;
    }
    return this.#state === 'open';
  }

  recordSuccess(): void {
    this.#failures = 0;
    this.#state = 'closed';
    this.#openUntil = 0;
  }

  recordFailure(): void {
    if (this.#state === 'half-open') {
      this.#openCircuit();
      return;
    }

    this.#failures += 1;
    if (this.#failures >= this.#failureThreshold) {
      this.#openCircuit();
    }
  }

  #openCircuit(): void {
    this.#state = 'open';
    this.#openUntil = this.#now() + this.#resetTimeoutMs;
    this.#failures = 0;
  }
}
