import type { DashboardPayload } from '@/types/testlens';

/**
 * Seam between the Dashboard UI and `GET /api/repos/:repoId/dashboard`.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

/** localStorage key the onboarding flow writes the chosen repo id to. */
const ACTIVE_REPO_KEY = 'tl.activeRepoId';

/** Repo id selected during onboarding. */
export function getActiveRepoId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_REPO_KEY);
  } catch {
    return null;
  }
}

export class DashboardApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardApiError';
  }
}

function requireApiBase(): string {
  return API_BASE;
}

export async function getDashboard(repoId: string | null = getActiveRepoId()): Promise<DashboardPayload> {
  if (!repoId) {
    throw new DashboardApiError('No repository selected. Complete onboarding first.');
  }

  const res = await fetch(`${requireApiBase()}/api/repos/${encodeURIComponent(repoId)}/dashboard`, { credentials: 'include' });
  if (!res.ok) {
    throw new DashboardApiError(`Dashboard request failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as DashboardPayload;
}
