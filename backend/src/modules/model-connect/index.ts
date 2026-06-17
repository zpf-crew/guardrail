import { ModelConnect } from './model-connect.service.js';

export { ModelConnect } from './model-connect.service.js';
export { ModelClient } from './model-client.js';
export { FallbackModelClient } from './fallback-model-client.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { MODEL_ALIASES, resolveModelId } from './model-catalog.js';
export type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
  ChatRole,
  ModelClientConfig,
  ModelConnectConfig,
  ModelProviderConfig,
} from './model-connect.types.js';

/** Shared instance configured from environment variables. */
export const modelConnect = ModelConnect.fromEnv();
