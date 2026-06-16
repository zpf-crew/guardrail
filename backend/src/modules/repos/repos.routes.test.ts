import test from 'node:test';
import assert from 'node:assert/strict';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';
import { SESSION_COOKIE } from '../auth/session.service.js';
import { reposRoutes } from './repos.routes.js';

const TEST_SESSION_ID = 'repo-reset-session';
const TEST_USER_ID = 'user-1';
const TEST_REPO_ID = 'repo-1';

function authInjectOptions(): { cookies: Record<string, string> } {
  return { cookies: { [SESSION_COOKIE]: TEST_SESSION_ID } };
}

function repoRow(clonePath: string | null) {
  return {
    id: TEST_REPO_ID,
    github_repo_id: 123,
    full_name: 'acme/app',
    name: 'app',
    private: false,
    default_branch: 'main',
    clone_url: 'https://github.com/acme/app.git',
    html_url: 'https://github.com/acme/app',
    clone_path: clonePath,
    current_branch: 'main',
    commit_sha: 'abc123',
    status: 'cloned',
    last_cloned_at: new Date().toISOString(),
  };
}

async function buildRouteTestApp(db: Pool) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.decorate('db', db);
  await app.register(reposRoutes, { prefix: '/api/repos' });
  return app;
}

test('repo reset clears onboarding data, clone metadata, and managed clone directory', async () => {
  const workspaceRoot = path.resolve(process.cwd(), '.guardrail-workspaces');
  await mkdir(workspaceRoot, { recursive: true });
  const clonePath = await mkdtemp(path.join(workspaceRoot, 'repo-reset-'));
  await mkdir(clonePath, { recursive: true });
  await writeFile(path.join(clonePath, 'package.json'), '{}');

  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM sessions s')) {
        return { rows: params?.[0] === TEST_SESSION_ID ? [{
          id: TEST_USER_ID,
          github_id: 1,
          login: 'test',
          name: null,
          avatar_url: null,
        }] : [] };
      }
      if (sql.includes('SELECT * FROM repos WHERE id')) {
        return { rows: params?.[0] === TEST_REPO_ID && params?.[1] === TEST_USER_ID ? [repoRow(clonePath)] : [] };
      }
      if (sql.includes('DELETE FROM onboarding_scan_results')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE repos') && sql.includes("status = 'pending'")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  const app = await buildRouteTestApp(db);
  try {
    const res = await app.inject({
      method: 'POST',
      url: `/api/repos/${TEST_REPO_ID}/reset`,
      ...authInjectOptions(),
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
    await assert.rejects(() => stat(clonePath), /ENOENT/);
    assert.ok(calls.some(call => call.sql.includes('DELETE FROM onboarding_scan_results')));
    assert.ok(calls.some(call => call.sql.includes('UPDATE repos') && call.sql.includes('clone_path = null')));
  } finally {
    await app.close();
    await rm(clonePath, { recursive: true, force: true });
  }
});

test('repo reset returns 404 for repositories outside the authenticated user', async () => {
  const db = {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM sessions s')) {
        return { rows: params?.[0] === TEST_SESSION_ID ? [{
          id: TEST_USER_ID,
          github_id: 1,
          login: 'test',
          name: null,
          avatar_url: null,
        }] : [] };
      }
      if (sql.includes('SELECT * FROM repos WHERE id')) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  const app = await buildRouteTestApp(db);
  try {
    const res = await app.inject({
      method: 'POST',
      url: `/api/repos/${TEST_REPO_ID}/reset`,
      ...authInjectOptions(),
    });

    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});
