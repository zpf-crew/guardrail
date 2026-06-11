import type { ModelProfile } from '../../models/model.types.js';

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

export interface ModelConnectConfig {
  baseUrl: string;
  apiKey: string;
  chatPath?: string;
  thinkerModel: string;
  coderModel: string;
  fetchImpl?: typeof fetch;
}

export interface ModelClientConfig {
  baseUrl: string;
  apiKey: string;
  chatPath: string;
  model: string;
  profile: ModelProfile;
  fetchImpl?: typeof fetch;
}
