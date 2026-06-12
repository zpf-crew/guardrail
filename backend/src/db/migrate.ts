import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { env } from '../config/env.js';

async function main() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const migrationsDir = path.resolve(process.cwd(), 'db/migrations');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (existing.rowCount) {
        console.log(`Skipping ${file}`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
