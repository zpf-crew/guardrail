import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import type { GitHubUser } from './auth.types.js';

interface GitHubTokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function requireGithubEnv() {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_CALLBACK_URL) {
    throw new Error('GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_CALLBACK_URL are required');
  }
}

export function createOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

export function buildGithubAuthorizeUrl(state: string): string {
  requireGithubEnv();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID!);
  url.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL!);
  url.searchParams.set('scope', 'repo read:user');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGithubCode(code: string): Promise<{ accessToken: string; scope: string | null }> {
  requireGithubEnv();
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
    }),
  });

  const payload = (await response.json()) as GitHubTokenResponse;
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? 'GitHub token exchange failed');
  }

  return { accessToken: payload.access_token, scope: payload.scope ?? null };
}

export async function fetchGithubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'guardrail',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user request failed (${response.status})`);
  }

  return (await response.json()) as GitHubUser;
}
