import type { AuthMeResponse } from '@/types/testlens';
import { getApiBase } from './api-base';

const API_BASE = getApiBase();

export class AuthApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export function loginWithGitHub() {
  window.location.href = `${API_BASE}/api/auth/github`;
}

export async function getMe(): Promise<AuthMeResponse> {
  const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
  if (!res.ok) {
    throw new AuthApiError(`Auth request failed (${res.status})`);
  }
  return (await res.json()) as AuthMeResponse;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}
