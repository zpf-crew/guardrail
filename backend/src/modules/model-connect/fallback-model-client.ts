import type { CircuitBreaker } from './circuit-breaker.js';
import type { ModelClient } from './model-client.js';
import type { ChatCompletionResult, ChatMessage, ChatOptions } from './model-connect.types.js';
import { ModelClientError } from './model-errors.js';

function shouldTryFallback(error: unknown): boolean {
  if (!(error instanceof ModelClientError)) return true;
  if (error.code === 'model_aborted') return false;
  if (error.code === 'model_config_missing') return false;
  return true;
}

export class FallbackModelClient {
  readonly #primary: ModelClient;
  readonly #fallback: ModelClient | null;
  readonly #circuitBreaker: CircuitBreaker;

  constructor(primary: ModelClient, fallback: ModelClient | null, circuitBreaker: CircuitBreaker) {
    this.#primary = primary;
    this.#fallback = fallback;
    this.#circuitBreaker = circuitBreaker;
  }

  get profile() {
    return this.#primary.profile;
  }

  get model() {
    return this.#primary.model;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatCompletionResult> {
    try {
      return await this.#primary.chat(messages, options);
    } catch (primaryError) {
      if (!this.#fallback || !shouldTryFallback(primaryError) || this.#circuitBreaker.isOpen()) {
        throw primaryError;
      }

      try {
        const result = await this.#fallback.chat(messages, options);
        this.#circuitBreaker.recordSuccess();
        return result;
      } catch (fallbackError) {
        this.#circuitBreaker.recordFailure();
        throw combineProviderErrors(primaryError, fallbackError);
      }
    }
  }
}

function combineProviderErrors(primaryError: unknown, fallbackError: unknown): ModelClientError {
  const primary = primaryError instanceof ModelClientError
    ? primaryError
    : new ModelClientError({
      code: 'model_network_error',
      message: primaryError instanceof Error ? primaryError.message : String(primaryError),
      retryable: true,
      cause: primaryError,
    });
  const fallback = fallbackError instanceof ModelClientError
    ? fallbackError
    : new ModelClientError({
      code: 'model_network_error',
      message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      retryable: true,
      cause: fallbackError,
    });

  return new ModelClientError({
    code: fallback.code,
    message: `Primary provider failed (${primary.message}); fallback provider failed (${fallback.message})`,
    retryable: fallback.retryable,
    status: fallback.status,
    cause: fallback,
  });
}
