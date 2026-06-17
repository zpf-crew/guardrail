import type { ModelProfile } from '../../models/model.types.js';

export type ModelProviderRole = 'primary' | 'fallback';

export interface ModelCallLogContext {
  profile: ModelProfile;
  model: string;
  provider: ModelProviderRole;
  endpoint: string;
}

export function logModelCallSuccess(context: ModelCallLogContext): void {
  if (process.env.NODE_ENV === 'test' || process.env.MODEL_CALL_LOG === '0') return;

  const host = endpointHost(context.endpoint);
  console.info(
    `[model-connect] ${context.profile} call succeeded via ${context.provider} (${context.model} @ ${host})`,
  );
}

function endpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'unknown';
  }
}
