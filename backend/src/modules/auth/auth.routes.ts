import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';
import {
  buildGithubAuthorizeUrl,
  createOAuthState,
  exchangeGithubCode,
  fetchGithubUser,
} from './github-oauth.service.js';
import { encryptToken } from './token-crypto.js';
import { clearSession, createSession, getRequestUser } from './session.service.js';

function frontendUrl(path: string): string {
  const base = env.FRONTEND_URL ?? 'http://localhost:5173';
  return new URL(path, base).toString();
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/github', async (_request, reply) => {
    const state = createOAuthState();
    const repository = new AuthRepository(app.db);
    await repository.createOAuthState(state, new Date(Date.now() + 10 * 60 * 1000));
    return reply.redirect(buildGithubAuthorizeUrl(state));
  });

  app.get('/github/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    if (query.error) {
      return reply.redirect(frontendUrl(`/login?error=${encodeURIComponent(query.error)}`));
    }
    if (!query.code || !query.state) {
      return reply.code(400).send({ error: 'Missing GitHub OAuth code or state' });
    }

    const repository = new AuthRepository(app.db);
    const validState = await repository.consumeOAuthState(query.state);
    if (!validState) {
      return reply.redirect(frontendUrl('/login?error=invalid_state'));
    }

    const { accessToken, scope } = await exchangeGithubCode(query.code);
    const githubUser = await fetchGithubUser(accessToken);
    const user = await repository.upsertUser(githubUser);
    await repository.saveToken(user.id, encryptToken(accessToken), scope);
    await createSession(reply, repository, user.id);
    return reply.redirect(frontendUrl('/onboarding'));
  });

  app.get('/me', async (request, reply) => {
    const user = await getRequestUser(request);
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    return { user };
  });

  app.post('/logout', async (request, reply) => {
    await clearSession(request, reply);
    return { ok: true };
  });
}
