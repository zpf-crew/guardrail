import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
  ModelClientConfig,
} from './model-connect.types.js';

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const segment = path.replace(/^\/+/, '');
  return `${base}/${segment}`;
}

function extractAssistantContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('LLM response was not a JSON object');
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

  throw new Error('LLM response did not contain assistant content');
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
      throw new Error('LLM_BASE_URL is not configured');
    }
    if (!apiKey) {
      throw new Error('LLM_API_KEY is not configured');
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

    const response = await fetchImpl(joinUrl(baseUrl, chatPath), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    const raw = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        raw && typeof raw === 'object' && 'error' in raw
          ? JSON.stringify((raw as { error: unknown }).error)
          : response.statusText;
      throw new Error(`LLM request failed (${response.status}): ${detail}`);
    }

    return {
      content: extractAssistantContent(raw),
      model,
      profile,
      raw,
    };
  }
}
