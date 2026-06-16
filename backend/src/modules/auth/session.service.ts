import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthUser } from './auth.types.js';

export const SESSION_COOKIE = 'gr_session';

export interface SessionCookiePolicyInput {
  backendUrl?: string;
  frontendUrl?: string;
}

function originFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function resolveSessionCookiePolicy(input: SessionCookiePolicyInput) {
  const backendOrigin = originFromUrl(input.backendUrl);
  const frontendOrigin = originFromUrl(input.frontendUrl);
  const secure = input.backendUrl?.startsWith('https://') ?? false;
  const crossOriginFrontend = Boolean(secure && backendOrigin && frontendOrigin && backendOrigin !== frontendOrigin);

  return {
    secure,
    sameSite: crossOriginFrontend ? 'none' as const : 'lax' as const,
  };
}

export function sessionCookieOptions(expires?: Date) {
  const policy = resolveSessionCookiePolicy({
    backendUrl: env.BACKEND_URL,
    frontendUrl: env.FRONTEND_URL,
  });

  return {
    httpOnly: true,
    sameSite: policy.sameSite,
    secure: policy.secure,
    path: '/',
    expires,
  };
}

export function createSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionExpiresAt(): Date {
  return new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(reply: FastifyReply, repository: AuthRepository, userId: string): Promise<void> {
  const sessionId = createSessionId();
  const expiresAt = sessionExpiresAt();
  await repository.createSession(sessionId, userId, expiresAt);
  reply.setCookie(SESSION_COOKIE, sessionId, sessionCookieOptions(expiresAt));
}

export async function getRequestUser(request: FastifyRequest): Promise<AuthUser | null> {
  const sessionId = request.cookies?.[SESSION_COOKIE];
  if (!sessionId) return null;
  return new AuthRepository(request.server.db).getUserBySession(sessionId);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await getRequestUser(request);
  if (!user) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  request.user = user;
}

export async function clearSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = request.cookies?.[SESSION_COOKIE];
  if (sessionId) {
    await new AuthRepository(request.server.db).deleteSession(sessionId);
  }
  reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(new Date(0)));
}
