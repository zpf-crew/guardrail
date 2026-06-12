import type { Pool } from 'pg';
import type { AuthUser, GitHubUser } from './auth.types.js';

function mapUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    githubId: Number(row.github_id),
    login: String(row.login),
    name: row.name ? String(row.name) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
  };
}

export class AuthRepository {
  constructor(private readonly db: Pool) {}

  async createOAuthState(state: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      'INSERT INTO oauth_states (state, expires_at) VALUES ($1, $2)',
      [state, expiresAt],
    );
  }

  async consumeOAuthState(state: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM oauth_states WHERE state = $1 AND expires_at > now() RETURNING state',
      [state],
    );
    await this.db.query('DELETE FROM oauth_states WHERE expires_at <= now()');
    return result.rowCount === 1;
  }

  async upsertUser(user: GitHubUser): Promise<AuthUser> {
    const result = await this.db.query(
      `INSERT INTO users (github_id, login, name, avatar_url, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (github_id)
       DO UPDATE SET login = EXCLUDED.login, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, updated_at = now()
       RETURNING id, github_id, login, name, avatar_url`,
      [user.id, user.login, user.name, user.avatar_url],
    );
    return mapUser(result.rows[0]);
  }

  async saveToken(userId: string, encryptedToken: string, scope: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO github_tokens (user_id, access_token_enc, scope, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET access_token_enc = EXCLUDED.access_token_enc, scope = EXCLUDED.scope, updated_at = now()`,
      [userId, encryptedToken, scope],
    );
  }

  async getEncryptedToken(userId: string): Promise<string | null> {
    const result = await this.db.query('SELECT access_token_enc FROM github_tokens WHERE user_id = $1', [userId]);
    return result.rows[0]?.access_token_enc ?? null;
  }

  async createSession(sessionId: string, userId: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
      [sessionId, userId, expiresAt],
    );
  }

  async getUserBySession(sessionId: string): Promise<AuthUser | null> {
    const result = await this.db.query(
      `SELECT u.id, u.github_id, u.login, u.name, u.avatar_url
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > now()`,
      [sessionId],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }
}
