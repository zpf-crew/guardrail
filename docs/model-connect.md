# Model Connect

Model Connect is the backend helper for calling LLMs through an **OpenAI-compatible** HTTP API.

Guardrail uses two **model profiles** — not hardcoded model names in business logic:

| Profile | Purpose | Default logical name | Provider path (GreenNode) |
|---------|---------|----------------------|---------------------------|
| **thinker** | Reasoning, classification, gap analysis, review summaries | `gemma-4` | `google/gemma-3-27b-it` |
| **coder** | Writing/updating tests, mocks, fixtures | `qwen-3.6-coder` | `qwen/qwen3-5-27b` |

Call by profile in code; swap models via environment variables.

## Environment variables

Set these before starting the backend (see root [README](../README.md#environment-setup)):

### Primary provider (priority)

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_BASE_URL` | Yes (for LLM calls) | OpenAI-compatible base URL, e.g. `https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1` |
| `LLM_API_KEY` | Yes (for LLM calls) | Bearer token for the primary LLM provider |
| `LLM_CHAT_PATH` | No | API path segment after base URL. Default: `messages` (GreenNode). Use `chat/completions` for standard OpenAI. |
| `LLM_THINKER_MODEL` | No | Logical name or full provider path for the thinker profile. Default: `gemma-4` |
| `LLM_CODER_MODEL` | No | Logical name or full provider path for the coder profile. Default: `qwen-3.6-coder` |

### Fallback provider (optional)

Configure a second provider with its own connection settings. Guardrail tries the primary provider first and only calls the fallback when the primary request fails. A per-profile circuit breaker opens after repeated fallback failures (5 failures, 60s reset) so a dead fallback provider is not hammered on every request.

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_FALLBACK_BASE_URL` | No | Fallback OpenAI-compatible base URL |
| `LLM_FALLBACK_API_KEY` | No | Bearer token for the fallback provider |
| `LLM_FALLBACK_CHAT_PATH` | No | Fallback API path. Defaults to `LLM_CHAT_PATH` |
| `LLM_FALLBACK_THINKER_MODEL` | No | Fallback thinker model. Defaults to `LLM_THINKER_MODEL` |
| `LLM_FALLBACK_CODER_MODEL` | No | Fallback coder model. Defaults to `LLM_CODER_MODEL` |

Fallback is enabled when both `LLM_FALLBACK_BASE_URL` and `LLM_FALLBACK_API_KEY` are set.

If a model value contains `/` (e.g. `qwen/qwen3-5-27b`), it is sent to the provider as-is. Otherwise it is resolved through the alias map in `backend/src/modules/model-connect/model-catalog.ts`.

## Quick start

```ts
import { modelConnect } from './modules/model-connect/index.js';

// Reasoning / analysis
const thinker = modelConnect.getThinker();
const analysis = await thinker.chat([
  { role: 'assistant', content: 'You are Guardrail, a testing intelligence agent.' },
  { role: 'user', content: 'Classify test gaps for the coupon module.' },
]);
console.log(analysis.content);

// Test generation / code edits
const coder = modelConnect.getCoder();
const draft = await coder.chat([
  { role: 'system', content: 'Write tests only. Match existing project style.' },
  { role: 'user', content: 'Add unit tests for minimum purchase validation.' },
]);
console.log(draft.content);
```

## API reference

### `modelConnect` (singleton)

Pre-configured from environment via `ModelConnect.fromEnv()`.

- `getThinker()` → resilient client for the thinker profile (primary with optional fallback)
- `getCoder()` → resilient client for the coder profile (primary with optional fallback)
- `getClient('thinker' | 'coder')` → same clients by profile name

### `ModelClient#chat(messages, options?)`

**`messages`** — array of `{ role: 'system' | 'user' | 'assistant', content: string }`

**`options`** (optional):

- `temperature?: number`
- `maxTokens?: number`
- `signal?: AbortSignal`

**Returns** `ChatCompletionResult`:

```ts
{
  content: string;   // assistant text
  model: string;     // resolved provider model id
  profile: 'thinker' | 'coder';
  raw: unknown;      // full JSON response from provider
}
```

Throws if the primary provider's `LLM_BASE_URL` or `LLM_API_KEY` is missing when a request is made, if both providers fail, or if the HTTP call fails without a configured fallback.

### Custom instance (tests or overrides)

```ts
import { ModelConnect } from './modules/model-connect/index.js';

const connect = new ModelConnect({
  baseUrl: 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1',
  apiKey: process.env.LLM_API_KEY!,
  chatPath: 'messages',
  thinkerModel: 'google/gemma-3-27b-it',
  coderModel: 'qwen/qwen3-5-27b',
  fallback: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.LLM_FALLBACK_API_KEY!,
    chatPath: 'chat/completions',
    thinkerModel: 'gpt-4.1-mini',
    coderModel: 'gpt-4.1-mini',
  },
});

// Or from env with partial overrides
const connect = ModelConnect.fromEnv({ thinkerModel: 'qwen/qwen3-5-27b' });
```

Pass `fetchImpl` in config to stub HTTP in unit tests.

## Provider example (GreenNode)

Equivalent to:

```bash
curl --request POST \
  --url 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1/messages' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer $LLM_API_KEY' \
  --data '{
    "model": "qwen/qwen3-5-27b",
    "messages": [
      { "role": "user", "content": "What is AI?" }
    ]
  }'
```

Model Connect builds the same request shape: `POST {LLM_BASE_URL}/{LLM_CHAT_PATH}` with `Authorization: Bearer` and a `{ model, messages }` JSON body.

Successful calls are logged to stdout as:

```text
[model-connect] thinker call succeeded via primary (google/gemma-4-31b-it @ maas-llm-aiplatform-hcm.api.vngcloud.vn)
[model-connect] coder call succeeded via fallback (qwen3.6-plus @ opencode.ai)
```

Logs include profile, provider role (`primary` or `fallback`), resolved model id, and endpoint host (never the API key).

## When to use which profile

**Thinker** — repository scan reasoning, spec understanding, gap classification, risk analysis, failure explanation, review summaries.

**Coder** — generating or updating test files, mocks, fixtures, and UI/mobile/browser test scenarios.

Do not hardcode model names in feature code; always go through `modelConnect.getThinker()` or `modelConnect.getCoder()`.

## Source layout

```
backend/src/modules/model-connect/
  index.ts                  # exports + modelConnect singleton
  model-connect.service.ts  # ModelConnect class
  model-client.ts           # HTTP client + chat()
  fallback-model-client.ts  # primary/fallback routing
  circuit-breaker.ts        # fallback circuit breaker
  model-catalog.ts          # profile → model alias map
  model-connect.types.ts    # shared types
```
