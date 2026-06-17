import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
  ModelClientConfig,
} from './model-connect.types.js';
import { withModelCallLimit } from './model-call-limiter.js';
import { logModelCallSuccess } from './model-call-logger.js';
import { ModelClientError, normalizeModelError } from './model-errors.js';

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const segment = path.replace(/^\/+/, '');
  return `${base}/${segment}`;
}

function extractAssistantContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new ModelClientError({
      code: 'model_response_invalid',
      message: 'LLM response was not a JSON object',
      retryable: true,
    });
  }

  const data = payload as Record<string, unknown>;

  const openAiChoice = (data.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]
    ?.message?.content;
  if (typeof openAiChoice === 'string') {
    return openAiChoice;
  }

  if (typeof data.content === 'string') {
    return data.content;
  }

  const messageContent = (data.message as { content?: string } | undefined)?.content;
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  const blocks = data.content as Array<{ type?: string; text?: string }> | undefined;
  if (Array.isArray(blocks)) {
    const text = blocks
      .filter(block => block.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join('');
    if (text) {
      return text;
    }
  }

  throw new ModelClientError({
    code: 'model_content_empty',
    message: 'LLM response did not contain assistant content',
    retryable: true,
  });
}

export class ModelClient {
  private readonly config: ModelClientConfig;

  constructor(config: ModelClientConfig) {
    this.config = config;
  }

  get profile() {
    return this.config.profile;
  }

  get model() {
    return this.config.model;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatCompletionResult> {
    const { baseUrl, apiKey, chatPath, model, profile, fetchImpl = fetch } = this.config;

    if (!baseUrl) {
      throw new ModelClientError({
        code: 'model_config_missing',
        message: 'LLM_BASE_URL is not configured',
        retryable: false,
      });
    }
    if (!apiKey) {
      throw new ModelClientError({
        code: 'model_config_missing',
        message: 'LLM_API_KEY is not configured',
        retryable: false,
      });
    }

    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    let response: Response;
    try {
      response = await withModelCallLimit(options.signal, () =>
        fetchImpl(joinUrl(baseUrl, chatPath), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: options.signal,
        }),
      );
    } catch (error) {
      throw normalizeModelError(error);
    }

    const raw = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        raw && typeof raw === 'object' && 'error' in raw
          ? JSON.stringify((raw as { error: unknown }).error)
          : response.statusText;
      const code = response.status === 401 || response.status === 403
        ? 'model_auth_failed'
        : response.status === 429
          ? 'model_http_429'
          : response.status >= 500
            ? 'model_http_5xx'
            : 'model_http_failed';
      throw new ModelClientError({
        code,
        message: `LLM request failed (${response.status}): ${detail}`,
        retryable: response.status === 429 || response.status >= 500,
        status: response.status,
      });
    }

    const result = {
      content: extractAssistantContent(raw),
      model,
      profile,
      raw,
    };

    logModelCallSuccess({
      profile,
      model: result.model,
      provider: this.config.providerRole ?? 'primary',
      endpoint: baseUrl,
    });

    return result;
  }
}
