import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const configDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(configDir, '..', '..');
const repoRoot = join(backendRoot, '..');
const envPath = join(repoRoot, '.env');

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
