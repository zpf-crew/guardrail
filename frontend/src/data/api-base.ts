interface GuardrailRuntimeConfig {
  apiBaseUrl?: string;
}

declare global {
  interface Window {
    __GUARDRAIL_CONFIG__?: GuardrailRuntimeConfig;
  }
}

export function getApiBase(): string {
  return window.__GUARDRAIL_CONFIG__?.apiBaseUrl?.trim()
    || import.meta.env.VITE_API_BASE_URL?.trim()
    || '';
}

