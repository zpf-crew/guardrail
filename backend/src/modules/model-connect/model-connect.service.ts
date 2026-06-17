import { env } from '../../config/env.js';
import type { ModelProfile } from '../../models/model.types.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { FallbackModelClient } from './fallback-model-client.js';
import { resolveModelId } from './model-catalog.js';
import { ModelClient } from './model-client.js';
import type { ModelConnectConfig, ModelProviderConfig } from './model-connect.types.js';

function isProviderConfigured(provider: Pick<ModelProviderConfig, 'baseUrl' | 'apiKey'>): boolean {
  return Boolean(provider.baseUrl && provider.apiKey);
}

export class ModelConnect {
  private readonly clients: Record<ModelProfile, FallbackModelClient>;

  constructor(config: ModelConnectConfig) {
    const chatPath = config.chatPath ?? 'chat/completions';
    const fetchImpl = config.fetchImpl;
    const fallbackConfigured = config.fallback && isProviderConfigured(config.fallback);

    this.clients = {
      thinker: this.createProfileClient({
        profile: 'thinker',
        model: config.thinkerModel,
        chatPath,
        fetchImpl,
        primary: config,
        fallback: fallbackConfigured ? config.fallback : undefined,
      }),
      coder: this.createProfileClient({
        profile: 'coder',
        model: config.coderModel,
        chatPath,
        fetchImpl,
        primary: config,
        fallback: fallbackConfigured ? config.fallback : undefined,
      }),
    };
  }

  private createProfileClient(args: {
    profile: ModelProfile;
    model: string;
    chatPath: string;
    fetchImpl?: typeof fetch;
    primary: ModelProviderConfig;
    fallback?: ModelProviderConfig;
  }): FallbackModelClient {
    const primary = new ModelClient({
      baseUrl: args.primary.baseUrl,
      apiKey: args.primary.apiKey,
      chatPath: args.chatPath,
      model: args.model,
      profile: args.profile,
      fetchImpl: args.fetchImpl,
    });

    const fallback = args.fallback
      ? new ModelClient({
        baseUrl: args.fallback.baseUrl,
        apiKey: args.fallback.apiKey,
        chatPath: args.fallback.chatPath ?? args.chatPath,
        model: args.profile === 'thinker' ? args.fallback.thinkerModel : args.fallback.coderModel,
        profile: args.profile,
        fetchImpl: args.fetchImpl,
      })
      : null;

    return new FallbackModelClient(primary, fallback, new CircuitBreaker());
  }

  static fromEnv(overrides: Partial<ModelConnectConfig> = {}): ModelConnect {
    const thinkerModel =
      overrides.thinkerModel ??
      resolveModelId('thinker', env.LLM_THINKER_MODEL);
    const coderModel =
      overrides.coderModel ??
      resolveModelId('coder', env.LLM_CODER_MODEL);

    const fallbackBaseUrl = overrides.fallback?.baseUrl ?? env.LLM_FALLBACK_BASE_URL ?? '';
    const fallbackApiKey = overrides.fallback?.apiKey ?? env.LLM_FALLBACK_API_KEY ?? '';
    const fallbackConfigured = Boolean(fallbackBaseUrl && fallbackApiKey);

    const fallbackThinkerModel = overrides.fallback?.thinkerModel
      ?? (env.LLM_FALLBACK_THINKER_MODEL
        ? resolveModelId('thinker', env.LLM_FALLBACK_THINKER_MODEL)
        : thinkerModel);
    const fallbackCoderModel = overrides.fallback?.coderModel
      ?? (env.LLM_FALLBACK_CODER_MODEL
        ? resolveModelId('coder', env.LLM_FALLBACK_CODER_MODEL)
        : coderModel);

    return new ModelConnect({
      baseUrl: overrides.baseUrl ?? env.LLM_BASE_URL ?? '',
      apiKey: overrides.apiKey ?? env.LLM_API_KEY ?? '',
      chatPath: overrides.chatPath ?? env.LLM_CHAT_PATH ?? 'messages',
      thinkerModel,
      coderModel,
      fetchImpl: overrides.fetchImpl,
      fallback: fallbackConfigured
        ? {
          baseUrl: fallbackBaseUrl,
          apiKey: fallbackApiKey,
          chatPath: overrides.fallback?.chatPath ?? env.LLM_FALLBACK_CHAT_PATH ?? env.LLM_CHAT_PATH ?? 'messages',
          thinkerModel: fallbackThinkerModel,
          coderModel: fallbackCoderModel,
        }
        : overrides.fallback,
    });
  }

  getThinker(): FallbackModelClient {
    return this.clients.thinker;
  }

  getCoder(): FallbackModelClient {
    return this.clients.coder;
  }

  getClient(profile: ModelProfile): FallbackModelClient {
    return this.clients[profile];
  }
}
