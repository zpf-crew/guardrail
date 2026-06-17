import type { ModelProfile } from '../../models/model.types.js';

export type ModelProviderRole = 'primary' | 'fallback';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  profile: ModelProfile;
  raw: unknown;
}

export interface ModelProviderConfig {
  baseUrl: string;
  apiKey: string;
  chatPath?: string;
  thinkerModel: string;
  coderModel: string;
}

export interface ModelConnectConfig extends ModelProviderConfig {
  fallback?: ModelProviderConfig;
  fetchImpl?: typeof fetch;
}

export interface ModelClientConfig {
  baseUrl: string;
  apiKey: string;
  chatPath: string;
  model: string;
  profile: ModelProfile;
  providerRole?: ModelProviderRole;
  fetchImpl?: typeof fetch;
}
