import type { FastifyInstance } from 'fastify';

export async function dbPlugin(app: FastifyInstance) {
  // TODO: connect to PostgreSQL via DATABASE_URL
  app.log.info('Database plugin placeholder registered');
}
