import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Pool } from 'pg';
import { env } from '../config/env.js';

async function registerDb(app: FastifyInstance) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  app.decorate('db', pool);
  app.addHook('onClose', async () => {
    await pool.end();
  });
}

export const dbPlugin = fp(registerDb, { name: 'db' });
