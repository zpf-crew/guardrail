import type { Pool } from 'pg';
import type { AuthUser } from '../modules/auth/auth.types.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }

  interface FastifyRequest {
    user?: AuthUser;
  }
}
