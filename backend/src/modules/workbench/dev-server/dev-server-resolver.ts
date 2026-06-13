import { createServer } from 'node:net';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export type DevServerTarget =
  | { kind: 'subprocess'; command: string; args: string[]; cwd: string; port: number; healthPath: string }
  | { kind: 'docker'; composeFile: string; service: string; port: number; healthPath: string; projectName: string };

type PackageManager = 'pnpm' | 'yarn' | 'npm';

const COMPOSE_FILE_NAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'] as const;
const WEB_SERVICE_NAMES = ['frontend', 'web', 'app', 'nginx'] as const;

async function fileExists(filePath: string): Promise<boolean> {
  return stat(filePath).then(info => info.isFile()).catch(() => false);
}

export async function pickEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to pick ephemeral port')));
        return;
      }
      const port = address.port;
      server.close(error => (error ? reject(error) : resolve(port)));
    });
    server.on('error', reject);
  });
}

async function detectPackageManager(clonePath: string): Promise<PackageManager> {
  const files = await readdir(clonePath).catch(() => [] as string[]);
  if (files.includes('pnpm-lock.yaml')) return 'pnpm';
  if (files.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

function buildDevArgs(packageManager: PackageManager, packageDir: string | null, port: number): string[] {
  const portArgs = ['--host', '127.0.0.1', '--port', String(port)];

  if (packageManager === 'pnpm') {
    return packageDir
      ? ['--dir', packageDir, 'dev', ...portArgs]
      : ['dev', ...portArgs];
  }

  if (packageManager === 'yarn') {
    return packageDir
      ? ['workspace', packageDir, 'dev', ...portArgs]
      : ['dev', ...portArgs];
  }

  return packageDir
    ? ['run', 'dev', '--prefix', packageDir, '--', ...portArgs]
    : ['run', 'dev', '--', ...portArgs];
}

function subprocessCommand(packageManager: PackageManager, packageDir: string | null): string {
  if (packageDir) {
    if (packageManager === 'pnpm') return `${packageManager} --dir ${packageDir}`;
    if (packageManager === 'yarn') return `${packageManager} workspace ${packageDir}`;
    return `${packageManager} run dev --prefix ${packageDir}`;
  }
  return packageManager;
}

async function findComposeFile(clonePath: string): Promise<string | null> {
  for (const fileName of COMPOSE_FILE_NAMES) {
    const filePath = join(clonePath, fileName);
    if (await fileExists(filePath)) return filePath;
  }
  return null;
}

async function detectWebService(composeFile: string): Promise<string | null> {
  const content = await readFile(composeFile, 'utf8');

  for (const serviceName of WEB_SERVICE_NAMES) {
    if (new RegExp(`^  ${serviceName}:`, 'm').test(content)) return serviceName;
  }

  const serviceMatches = [...content.matchAll(/^  ([a-zA-Z0-9_-]+):/gm)];
  for (const match of serviceMatches) {
    const serviceName = match[1];
    if (serviceName === 'services' || serviceName === 'version' || serviceName === 'networks' || serviceName === 'volumes') {
      continue;
    }
    const serviceBlock = content.slice(match.index ?? 0).match(
      new RegExp(`^  ${serviceName}:[\\s\\S]*?(?=^  [a-zA-Z0-9_-]+:|\\Z)`, 'm'),
    )?.[0] ?? '';
    if (/^\s+ports:/m.test(serviceBlock)) return serviceName;
  }

  return serviceMatches[0]?.[1] ?? null;
}

export async function resolveDevServerTarget(
  clonePath: string,
  options?: { sessionId?: string },
): Promise<DevServerTarget | null> {
  const port = await pickEphemeralPort();
  const packageManager = await detectPackageManager(clonePath);

  const frontendPackageJson = join(clonePath, 'frontend', 'package.json');
  if (await fileExists(frontendPackageJson)) {
    const scripts = JSON.parse(await readFile(frontendPackageJson, 'utf8')).scripts ?? {};
    if (scripts.dev) {
      return {
        kind: 'subprocess',
        command: subprocessCommand(packageManager, 'frontend'),
        args: buildDevArgs(packageManager, 'frontend', port),
        cwd: clonePath,
        port,
        healthPath: '/',
      };
    }
  }

  const rootPackageJson = join(clonePath, 'package.json');
  if (await fileExists(rootPackageJson)) {
    const scripts = JSON.parse(await readFile(rootPackageJson, 'utf8')).scripts ?? {};
    if (scripts.dev) {
      return {
        kind: 'subprocess',
        command: subprocessCommand(packageManager, null),
        args: buildDevArgs(packageManager, null, port),
        cwd: clonePath,
        port,
        healthPath: '/',
      };
    }
    if (scripts.start) {
      const startArgs = packageManager === 'npm' ? ['start'] : ['start'];
      return {
        kind: 'subprocess',
        command: packageManager,
        args: startArgs,
        cwd: clonePath,
        port,
        healthPath: '/',
      };
    }
  }

  const composeFile = await findComposeFile(clonePath);
  if (composeFile) {
    const service = await detectWebService(composeFile);
    if (service) {
      return {
        kind: 'docker',
        composeFile,
        service,
        port,
        healthPath: '/',
        projectName: `guardrail-wb-${options?.sessionId ?? 'local'}`,
      };
    }
  }

  return null;
}

export function resolveRouteFromScenario(scenarioText: string): string {
  const match = scenarioText.match(/(?:open|visit|navigate to)\s+(\/[\w/-]+)/i)
    ?? scenarioText.match(/path:\s*['"](\/[^'"]+)['"]/i);
  return match?.[1] ?? '/';
}
