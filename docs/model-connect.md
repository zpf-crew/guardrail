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

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_BASE_URL` | Yes (for LLM calls) | OpenAI-compatible base URL, e.g. `https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1` |
| `LLM_API_KEY` | Yes (for LLM calls) | Bearer token for the LLM provider |
| `LLM_CHAT_PATH` | No | API path segment after base URL. Default: `messages` (GreenNode). Use `chat/completions` for standard OpenAI. |
| `LLM_THINKER_MODEL` | No | Logical name or full provider path for the thinker profile. Default: `gemma-4` |
| `LLM_CODER_MODEL` | No | Logical name or full provider path for the coder profile. Default: `qwen-3.6-coder` |

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

- `getThinker()` → `ModelClient` for the thinker profile
- `getCoder()` → `ModelClient` for the coder profile
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

Throws if `LLM_BASE_URL` or `LLM_API_KEY` is missing when a request is made, or if the HTTP call fails.

### Custom instance (tests or overrides)

```ts
import { ModelConnect } from './modules/model-connect/index.js';

const connect = new ModelConnect({
  baseUrl: 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1',
  apiKey: process.env.LLM_API_KEY!,
  chatPath: 'messages',
  thinkerModel: 'google/gemma-3-27b-it',
  coderModel: 'qwen/qwen3-5-27b',
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
  model-catalog.ts          # profile → model alias map
  model-connect.types.ts    # shared types
```
