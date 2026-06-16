export type ModelErrorCode =
  | 'model_config_missing'
  | 'model_auth_failed'
  | 'model_rate_limited'
  | 'model_http_429'
  | 'model_http_5xx'
  | 'model_http_failed'
  | 'model_network_error'
  | 'model_queue_full'
  | 'model_response_invalid'
  | 'model_content_empty'
  | 'model_aborted'
  | 'model_output_invalid';

export class ModelClientError extends Error {
  readonly code: ModelErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(args: {
    code: ModelErrorCode;
    message: string;
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'ModelClientError';
    this.code = args.code;
    this.retryable = args.retryable;
    this.status = args.status;
    this.cause = args.cause;
  }
}

export function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && /abort/i.test(error.name)) return true;
  return error instanceof Error && /aborted|abort/i.test(error.message);
}

export function normalizeModelError(error: unknown): ModelClientError {
  if (error instanceof ModelClientError) return error;
  if (isAbortLike(error)) {
    return new ModelClientError({
      code: 'model_aborted',
      message: error instanceof Error ? error.message : 'Model request aborted',
      retryable: false,
      cause: error,
    });
  }
  if (error instanceof Error && /did not contain assistant content|assistant content/i.test(error.message)) {
    return new ModelClientError({
      code: 'model_content_empty',
      message: error.message,
      retryable: true,
      cause: error,
    });
  }
  return new ModelClientError({
    code: 'model_network_error',
    message: error instanceof Error ? error.message : String(error),
    retryable: true,
    cause: error,
  });
}

export function formatModelFailure(error: unknown, attempts: number): string {
  const normalized = normalizeModelError(error);
  return `${normalized.code} after ${attempts} attempt${attempts === 1 ? '' : 's'}: ${normalized.message}`;
}
