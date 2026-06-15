import { randomUUID } from 'node:crypto';

interface DiagnosticFetchOptions {
  source: string;
}

interface RequestSummary {
  id: string;
  source: string;
  path: string;
  model?: string;
  schemaName?: string;
  messageCount?: number;
  messageCharCounts?: number[];
  totalMessageChars?: number;
  maxTokens?: unknown;
}

export function createWorkbenchModelDiagnosticFetch(
  options: DiagnosticFetchOptions,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const startedAt = Date.now();
    const request = summarizeRequest(input, init, options.source);
    console.info('[workbench:model] request', JSON.stringify(request));

    try {
      const response = await fetchImpl(input, init);
      const responseSummary = await summarizeResponse(response);
      const logLevel = responseSummary.assistantContentDetected === false ? 'warn' : 'info';
      console[logLevel]('[workbench:model] response', JSON.stringify({
        ...request,
        status: response.status,
        ok: response.ok,
        durationMs: Date.now() - startedAt,
        response: responseSummary,
      }));
      return response;
    } catch (error) {
      console.warn('[workbench:model] network-error', JSON.stringify({
        ...request,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  };
}

function summarizeRequest(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1], source: string): RequestSummary {
  const id = randomUUID();
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const path = safeUrlPath(url);
  const body = typeof init?.body === 'string' ? safeJsonParse(init.body) : null;
  return {
    id,
    source,
    path,
    model: typeof body?.model === 'string' ? body.model : undefined,
    schemaName: extractSchemaName(body),
    messageCount: Array.isArray(body?.messages) ? body.messages.length : undefined,
    messageCharCounts: messageCharCounts(body),
    totalMessageChars: totalMessageChars(body),
    maxTokens: body?.max_tokens,
  };
}

async function summarizeResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.clone().text().catch(() => '');
  const raw = safeJsonParse(text);
  if (!raw || typeof raw !== 'object') {
    return { rawType: typeof raw, rawLength: text.length };
  }
  return summarizePayload(raw, text.length);
}

function summarizePayload(payload: Record<string, unknown>, rawLength: number): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    keys: Object.keys(payload).slice(0, 30),
    rawLength,
    assistantContentDetected: hasAssistantContent(payload),
  };

  if ('stop_reason' in payload) summary.stopReason = payload.stop_reason;
  if ('stop_sequence' in payload) summary.stopSequenceType = contentType(payload.stop_sequence);
  if ('role' in payload) summary.role = payload.role;

  const choices = payload.choices;
  if (Array.isArray(choices)) {
    summary.choices = choices.slice(0, 1).map(choice => {
      if (!choice || typeof choice !== 'object') return { type: typeof choice };
      const data = choice as Record<string, unknown>;
      const message = data.message && typeof data.message === 'object'
        ? data.message as Record<string, unknown>
        : null;
      return {
        keys: Object.keys(data),
        finishReason: data.finish_reason,
        stopReason: data.stop_reason,
        messageKeys: message ? Object.keys(message) : null,
        messageContentType: message ? contentType(message.content) : null,
      };
    });
  }

  const content = payload.content;
  if (Array.isArray(content)) {
    summary.content = content.slice(0, 3).map(block => {
      if (!block || typeof block !== 'object') return { type: typeof block };
      const data = block as Record<string, unknown>;
      return {
        keys: Object.keys(data),
        type: data.type,
        textType: typeof data.text,
        textLength: typeof data.text === 'string' ? data.text.length : undefined,
      };
    });
  } else if ('content' in payload) {
    summary.contentType = contentType(content);
  }

  const message = payload.message;
  if (message && typeof message === 'object') {
    const data = message as Record<string, unknown>;
    summary.messageKeys = Object.keys(data);
    summary.messageContentType = contentType(data.content);
  }

  if (payload.usage && typeof payload.usage === 'object') {
    summary.usage = pickUsageValues(payload.usage as Record<string, unknown>);
  }
  if (payload.error && typeof payload.error === 'object') {
    summary.errorKeys = Object.keys(payload.error as Record<string, unknown>);
  } else if (payload.error) {
    summary.errorType = typeof payload.error;
  }

  return summary;
}

function extractSchemaName(body: Record<string, unknown> | null): string | undefined {
  const messages = body?.messages;
  if (!Array.isArray(messages)) return undefined;
  const user = [...messages].reverse().find(message =>
    message && typeof message === 'object' && (message as Record<string, unknown>).role === 'user');
  const content = user && typeof user === 'object' ? (user as Record<string, unknown>).content : undefined;
  if (typeof content !== 'string') return undefined;
  const parsed = safeJsonParse(content);
  return typeof parsed?.schemaName === 'string' ? parsed.schemaName : undefined;
}

function messageCharCounts(body: Record<string, unknown> | null): number[] | undefined {
  const messages = body?.messages;
  if (!Array.isArray(messages)) return undefined;
  return messages.map(message => {
    if (!message || typeof message !== 'object') return 0;
    const content = (message as Record<string, unknown>).content;
    return typeof content === 'string' ? content.length : 0;
  });
}

function totalMessageChars(body: Record<string, unknown> | null): number | undefined {
  const counts = messageCharCounts(body);
  return counts ? counts.reduce((sum, count) => sum + count, 0) : undefined;
}

function hasAssistantContent(payload: Record<string, unknown>): boolean {
  const choices = payload.choices;
  if (Array.isArray(choices)) {
    const first = choices[0];
    const message = first && typeof first === 'object'
      ? (first as Record<string, unknown>).message
      : null;
    if (message && typeof message === 'object') {
      return typeof (message as Record<string, unknown>).content === 'string';
    }
  }

  if (typeof payload.content === 'string') return true;
  if (Array.isArray(payload.content)) {
    return payload.content.some(block =>
      block
      && typeof block === 'object'
      && (block as Record<string, unknown>).type === 'text'
      && typeof (block as Record<string, unknown>).text === 'string'
      && ((block as Record<string, unknown>).text as string).length > 0);
  }

  const message = payload.message;
  if (message && typeof message === 'object') {
    return typeof (message as Record<string, unknown>).content === 'string';
  }

  return false;
}

function contentType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function pickUsageValues(usage: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of [
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
  ]) {
    if (typeof usage[key] === 'number') result[key] = usage[key];
  }
  return Object.keys(result).length > 0 ? result : { keys: Object.keys(usage) };
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function safeUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/i, '');
  }
}
