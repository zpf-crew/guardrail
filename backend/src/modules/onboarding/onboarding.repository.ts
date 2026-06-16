import type { Pool } from 'pg';
import type { DashboardPayload, ScanLogEntry, ScanSummary } from './onboarding.types.js';

export class OnboardingRepository {
  constructor(private readonly db: Pool) {}

  async saveScanResult(input: {
    repoId: string;
    userId: string;
    summary: ScanSummary;
    logs: ScanLogEntry[];
    dashboard: DashboardPayload;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO onboarding_scan_results (repo_id, user_id, summary, logs, dashboard_payload, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (repo_id)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         summary = EXCLUDED.summary,
         logs = EXCLUDED.logs,
         dashboard_payload = EXCLUDED.dashboard_payload,
         updated_at = now()`,
      [
        input.repoId,
        input.userId,
        JSON.stringify(input.summary),
        JSON.stringify(input.logs),
        JSON.stringify(input.dashboard),
      ],
    );
  }

  async getDashboard(repoId: string, userId: string): Promise<DashboardPayload | null> {
    const result = await this.db.query(
      'SELECT dashboard_payload FROM onboarding_scan_results WHERE repo_id = $1 AND user_id = $2',
      [repoId, userId],
    );
    return result.rows[0]?.dashboard_payload as DashboardPayload | undefined ?? null;
  }

  async deleteForRepo(repoId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM onboarding_scan_results WHERE repo_id = $1 AND user_id = $2',
      [repoId, userId],
    );
  }
}
