import type { DashboardPayload } from '@/types/testlens';
import { mockDashboard } from './dashboardMockData';
import { getLatestDashboard } from './onboarding-api';

/**
 * The single seam between the UI and dashboard data.
 *
 * - No `VITE_API_BASE_URL` configured → resolves the mock fixture, so the
 *   Dashboard runs standalone during the hackathon.
 * - Configured → calls `GET /api/repos/:repoId/dashboard` (contract §4).
 *
 * Keep all transport concerns in this file; when the real endpoint firms up,
 * this is the only place that changes.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/** localStorage key the onboarding flow writes the chosen repo id to. */
const ACTIVE_REPO_KEY = 'tl.activeRepoId';

/** Repo id selected during onboarding. Isolated so the source is swappable. */
export function getActiveRepoId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_REPO_KEY);
  } catch {
    return null;
  }
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class DashboardApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardApiError';
  }
}

export async function getDashboard(repoId: string | null = getActiveRepoId()): Promise<DashboardPayload> {
  if (!API_BASE) {
    await delay(400); // brief delay so the loading skeleton is exercised in dev
    return getLatestDashboard(repoId) ?? mockDashboard;
  }

  if (!repoId) {
    throw new DashboardApiError('No repository selected. Complete onboarding first.');
  }

  const res = await fetch(`${API_BASE}/api/repos/${encodeURIComponent(repoId)}/dashboard`, { credentials: 'include' });
  if (!res.ok) {
    throw new DashboardApiError(`Dashboard request failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as DashboardPayload;
}
