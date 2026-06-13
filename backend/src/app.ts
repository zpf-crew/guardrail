import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { reposRoutes } from './modules/repos/repos.routes.js';
import { onboardingRoutes } from './modules/onboarding/onboarding.routes.js';
import { dbPlugin } from './plugins/db.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  app.register(cookie);
  app.register(dbPlugin);

  app.register(healthRoutes, { prefix: '/health' });
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(reposRoutes, { prefix: '/api/repos' });
  app.register(onboardingRoutes, { prefix: '/api/repos' });

  return app;
}
