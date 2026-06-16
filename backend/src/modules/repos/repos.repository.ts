import type { Pool } from 'pg';
import type { RepoRecord } from './repos.types.js';

interface RepoInput {
  userId: string;
  githubRepoId: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
}

function mapRepo(row: Record<string, unknown>): RepoRecord {
  return {
    id: String(row.id),
    githubRepoId: Number(row.github_repo_id),
    fullName: String(row.full_name),
    name: String(row.name),
    private: Boolean(row.private),
    defaultBranch: String(row.default_branch),
    cloneUrl: String(row.clone_url),
    htmlUrl: String(row.html_url),
    clonePath: row.clone_path ? String(row.clone_path) : null,
    currentBranch: row.current_branch ? String(row.current_branch) : null,
    commitSha: row.commit_sha ? String(row.commit_sha) : null,
    status: String(row.status),
    lastClonedAt: row.last_cloned_at ? new Date(String(row.last_cloned_at)).toISOString() : null,
  };
}

export class ReposRepository {
  constructor(private readonly db: Pool) {}

  async upsertPending(input: RepoInput): Promise<RepoRecord> {
    const result = await this.db.query(
      `INSERT INTO repos (
         user_id, github_repo_id, full_name, name, private, default_branch, clone_url, html_url, status, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now())
       ON CONFLICT (user_id, github_repo_id)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         name = EXCLUDED.name,
         private = EXCLUDED.private,
         default_branch = EXCLUDED.default_branch,
         clone_url = EXCLUDED.clone_url,
         html_url = EXCLUDED.html_url,
         updated_at = now()
       RETURNING *`,
      [
        input.userId,
        input.githubRepoId,
        input.fullName,
        input.name,
        input.private,
        input.defaultBranch,
        input.cloneUrl,
        input.htmlUrl,
      ],
    );
    return mapRepo(result.rows[0]);
  }

  async markCloned(repoId: string, clonePath: string, branch: string, commitSha: string): Promise<RepoRecord> {
    const result = await this.db.query(
      `UPDATE repos
       SET clone_path = $2, current_branch = $3, commit_sha = $4, status = 'cloned', last_cloned_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [repoId, clonePath, branch, commitSha],
    );
    return mapRepo(result.rows[0]);
  }

  async markFailed(repoId: string): Promise<void> {
    await this.db.query("UPDATE repos SET status = 'clone_failed', updated_at = now() WHERE id = $1", [repoId]);
  }

  async resetClone(repoId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE repos
       SET clone_path = null,
           current_branch = null,
           commit_sha = null,
           status = 'pending',
           last_cloned_at = null,
           updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [repoId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getForUser(repoId: string, userId: string): Promise<RepoRecord | null> {
    const result = await this.db.query('SELECT * FROM repos WHERE id = $1 AND user_id = $2', [repoId, userId]);
    return result.rows[0] ? mapRepo(result.rows[0]) : null;
  }

  async listForUser(userId: string): Promise<RepoRecord[]> {
    const result = await this.db.query('SELECT * FROM repos WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
    return result.rows.map(mapRepo);
  }
}
