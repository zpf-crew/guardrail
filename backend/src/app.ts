import Fastify from 'fastify';
import { healthRoutes } from './modules/health/health.routes.js';
import { workbenchRoutes } from './modules/workbench/index.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  // TODO: register plugins (db, auth, etc.)
  // TODO: register other modules

  app.register(healthRoutes, { prefix: '/health' });
  app.register(workbenchRoutes, { prefix: '/api/workbench' });

  return app;
}
