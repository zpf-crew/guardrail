import type { ModelProfile } from '../../models/model.types.js';

/** Logical names (env / code) → provider model path on GreenNode MaaS. */
export const MODEL_ALIASES: Record<string, string> = {
  'gemma-4': 'google/gemma-3-27b-it',
  'qwen-3.6': 'qwen/qwen3-5-27b',
  'qwen-3.6-coder': 'qwen/qwen3-5-27b',
};

const DEFAULT_MODEL_BY_PROFILE: Record<ModelProfile, string> = {
  thinker: 'gemma-4',
  coder: 'qwen-3.6-coder',
};

export function resolveModelId(profile: ModelProfile, configured?: string): string {
  const logicalName = configured?.trim() || DEFAULT_MODEL_BY_PROFILE[profile];
  if (logicalName.includes('/')) {
    return logicalName;
  }
  return MODEL_ALIASES[logicalName] ?? logicalName;
}
