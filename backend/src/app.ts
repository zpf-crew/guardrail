import Fastify from 'fastify';
import { healthRoutes } from './modules/health/health.routes.js';
import { workbenchRoutes } from './modules/workbench/index.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  // TODO: register plugins (db, auth, etc.)
  // TODO: register other modules
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
  });

  app.options('*', async (_request, reply) => {
    return reply.code(204).send();
  });

  app.register(healthRoutes, { prefix: '/health' });
  app.register(workbenchRoutes, { prefix: '/api/workbench' });

  return app;
}
