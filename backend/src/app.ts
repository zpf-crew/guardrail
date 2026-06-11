import Fastify from 'fastify';
import { healthRoutes } from './modules/health/health.routes.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  // TODO: register plugins (db, auth, etc.)
  // TODO: register other modules

  app.register(healthRoutes, { prefix: '/health' });

  return app;
}
