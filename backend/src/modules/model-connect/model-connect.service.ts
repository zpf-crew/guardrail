import { env } from '../../config/env.js';
import type { ModelProfile } from '../../models/model.types.js';
import { resolveModelId } from './model-catalog.js';
import { ModelClient } from './model-client.js';
import type { ModelConnectConfig } from './model-connect.types.js';

export class ModelConnect {
  private readonly clients: Record<ModelProfile, ModelClient>;

  constructor(config: ModelConnectConfig) {
    const chatPath = config.chatPath ?? 'chat/completions';
    const fetchImpl = config.fetchImpl;

    this.clients = {
      thinker: new ModelClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        chatPath,
        model: config.thinkerModel,
        profile: 'thinker',
        fetchImpl,
      }),
      coder: new ModelClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        chatPath,
        model: config.coderModel,
        profile: 'coder',
        fetchImpl,
      }),
    };
  }

  static fromEnv(overrides: Partial<ModelConnectConfig> = {}): ModelConnect {
    return new ModelConnect({
      baseUrl: overrides.baseUrl ?? env.LLM_BASE_URL ?? '',
      apiKey: overrides.apiKey ?? env.LLM_API_KEY ?? '',
      chatPath: overrides.chatPath ?? env.LLM_CHAT_PATH ?? 'messages',
      thinkerModel:
        overrides.thinkerModel ??
        resolveModelId('thinker', env.LLM_THINKER_MODEL),
      coderModel:
        overrides.coderModel ??
        resolveModelId('coder', env.LLM_CODER_MODEL),
      fetchImpl: overrides.fetchImpl,
    });
  }

  getThinker(): ModelClient {
    return this.clients.thinker;
  }

  getCoder(): ModelClient {
    return this.clients.coder;
  }

  getClient(profile: ModelProfile): ModelClient {
    return this.clients[profile];
  }
}
