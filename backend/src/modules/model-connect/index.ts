import { ModelConnect } from './model-connect.service.js';

export { ModelConnect } from './model-connect.service.js';
export { ModelClient } from './model-client.js';
export { MODEL_ALIASES, resolveModelId } from './model-catalog.js';
export type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
  ChatRole,
  ModelClientConfig,
  ModelConnectConfig,
} from './model-connect.types.js';

/** Shared instance configured from environment variables. */
export const modelConnect = ModelConnect.fromEnv();
