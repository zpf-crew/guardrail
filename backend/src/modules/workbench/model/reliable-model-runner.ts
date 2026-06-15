import type { ModelClient } from '../../model-connect/model-client.js';
import type { ChatMessage, ChatOptions } from '../../model-connect/model-connect.types.js';
import {
  ModelClientError,
  formatModelFailure,
  isAbortLike,
  normalizeModelError,
} from '../../model-connect/model-errors.js';

interface ReliableModelArgs<T> {
  client: Pick<ModelClient, 'chat'>;
  messagesForAttempt: (validationError: string | null) => ChatMessage[];
  chatOptions: ChatOptions;
  signal: AbortSignal;
  validate: (value: unknown) => T;
  modelCallAttempts?: number;
  outputRepairAttempts?: number;
  delaysMs?: number[];
}

export async function runReliableStructuredModel<T>(args: ReliableModelArgs<T>): Promise<T> {
  const modelCallAttempts = args.modelCallAttempts ?? 3;
  const outputRepairAttempts = args.outputRepairAttempts ?? 2;
  const delaysMs = args.delaysMs ?? [250, 750];
  let validationError: string | null = null;
  let outputAttempt = 0;
  let modelAttempt = 0;
  let lastError: unknown = null;

  while (outputAttempt < outputRepairAttempts) {
    outputAttempt += 1;
    modelAttempt = 0;

    while (modelAttempt < modelCallAttempts) {
      args.signal.throwIfAborted();
      modelAttempt += 1;

      try {
        const response = await args.client.chat(args.messagesForAttempt(validationError), {
          ...args.chatOptions,
          signal: args.signal,
        });
        const parsed = parseJsonObject(response.content);
        try {
          return args.validate(parsed);
        } catch (error) {
          throw new ModelClientError({
            code: 'model_output_invalid',
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
            cause: error,
          });
        }
      } catch (error) {
        if (isAbortLike(error) || args.signal.aborted) throw error;

        if (isOutputRepairError(error)) {
          validationError = error instanceof Error ? error.message : String(error);
          lastError = new ModelClientError({
            code: 'model_output_invalid',
            message: validationError,
            retryable: outputAttempt < outputRepairAttempts,
            cause: error,
          });
          break;
        }

        const modelError = normalizeModelError(error);
        lastError = modelError;
        if (!modelError.retryable || modelAttempt >= modelCallAttempts) {
          throw new Error(formatModelFailure(modelError, modelAttempt));
        }
        await sleep(delaysMs[modelAttempt - 1] ?? 0, args.signal);
      }
    }
  }

  throw new Error(formatModelFailure(lastError, modelAttempt || 1));
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : extractFirstJsonObject(trimmed);
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new ModelClientError({
      code: 'model_output_invalid',
      message: `Model returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      cause: error,
    });
  }
}

function extractFirstJsonObject(value: string): string {
  const start = value.indexOf('{');
  if (start < 0) return value;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return value;
}

function isOutputRepairError(error: unknown): boolean {
  return error instanceof ModelClientError && error.code === 'model_output_invalid';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
