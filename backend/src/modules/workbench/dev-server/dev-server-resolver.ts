import { createServer } from 'node:net';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export type DevServerTarget =
  | {
      kind: 'subprocess';
      command: string;
      args: string[];
      cwd: string;
      port: number;
      healthPath: string;
      installCommand?: string;
      installArgs?: string[];
    }
  | { kind: 'docker'; composeFile: string; service: string; port: number; healthPath: string; projectName: string };

type PackageManager = 'pnpm' | 'yarn' | 'npm';

const COMPOSE_FILE_NAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'] as const;
const WEB_SERVICE_NAMES = ['frontend', 'web', 'app', 'nginx'] as const;
const APP_PACKAGE_DIRS = ['frontend', 'app', 'web', 'client'] as const;

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

async function readPackageScripts(filePath: string): Promise<Record<string, string> | null> {
  if (!(await fileExists(filePath))) return null;
  try {
    const payload = JSON.parse(await readFile(filePath, 'utf8')) as { scripts?: Record<string, string> };
    return payload.scripts ?? {};
  } catch {
    return null;
  }
}

async function hasRootNodeWorkspace(clonePath: string): Promise<boolean> {
  const files = await readdir(clonePath).catch(() => [] as string[]);
  return files.some(file => (
    file === 'package.json'
    || file === 'pnpm-lock.yaml'
    || file === 'pnpm-workspace.yaml'
    || file === 'yarn.lock'
    || file === 'package-lock.json'
  ));
}

function formatScripts(scripts: Record<string, string> | null): string {
  if (!scripts) return 'package.json not found';
  const names = Object.keys(scripts).sort();
  return names.length > 0 ? names.join(', ') : 'no scripts';
}

export async function diagnoseDevServerResolution(clonePath: string): Promise<string[]> {
  const files = await readdir(clonePath).catch(() => [] as string[]);
  const packageManager = await detectPackageManager(clonePath);
  const appPackageDiagnostics = await Promise.all(APP_PACKAGE_DIRS.map(async dir => {
    const scripts = await readPackageScripts(join(clonePath, dir, 'package.json'));
    return `${dir}PackageScripts=${formatScripts(scripts)}`;
  }));
  const rootScripts = await readPackageScripts(join(clonePath, 'package.json'));
  const composeFile = await findComposeFile(clonePath);
  const composeService = composeFile ? await detectWebService(composeFile) : null;

  return [
    `clonePath=${clonePath}`,
    `topLevelFiles=${files.slice(0, 40).join(', ') || '<empty>'}`,
    `packageManager=${packageManager}`,
    ...appPackageDiagnostics,
    `rootPackageScripts=${formatScripts(rootScripts)}`,
    `composeFile=${composeFile ?? '<none>'}`,
    `composeWebService=${composeService ?? '<none>'}`,
    'resolverPolicy=known app package dev script, root package dev script, root package start script, then docker compose web service',
  ];
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

function buildInstallArgs(packageManager: PackageManager, hasPackageLock: boolean): string[] {
  if (packageManager === 'pnpm') return ['install', '--frozen-lockfile'];
  if (packageManager === 'yarn') return ['install', '--frozen-lockfile'];
  return hasPackageLock ? ['ci'] : ['install'];
}

function subprocessCommand(packageManager: PackageManager, packageDir: string | null): string {
  if (packageDir) {
    if (packageManager === 'pnpm') return `${packageManager} --dir ${packageDir}`;
    if (packageManager === 'yarn') return `${packageManager} workspace ${packageDir}`;
    return `${packageManager} run dev --prefix ${packageDir}`;
  }
  return packageManager;
}

async function subprocessTarget(
  clonePath: string,
  packageDir: string | null,
  script: 'dev' | 'start',
  port: number,
): Promise<Extract<DevServerTarget, { kind: 'subprocess' }>> {
  const runFromRoot = packageDir === null || await hasRootNodeWorkspace(clonePath);
  const cwd = runFromRoot ? clonePath : join(clonePath, packageDir);
  const commandPackageDir = runFromRoot ? packageDir : null;
  const packageManager = await detectPackageManager(cwd);
  const hasPackageLock = await fileExists(join(cwd, 'package-lock.json'));
  const args = script === 'dev'
    ? buildDevArgs(packageManager, commandPackageDir, port)
    : ['start'];

  return {
    kind: 'subprocess',
    command: script === 'dev' ? subprocessCommand(packageManager, commandPackageDir) : packageManager,
    args,
    cwd,
    port,
    healthPath: '/',
    installCommand: packageManager,
    installArgs: buildInstallArgs(packageManager, hasPackageLock),
  };
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

  for (const packageDir of APP_PACKAGE_DIRS) {
    const packageJson = join(clonePath, packageDir, 'package.json');
    if (await fileExists(packageJson)) {
      const scripts = JSON.parse(await readFile(packageJson, 'utf8')).scripts ?? {};
      if (scripts.dev) {
        return subprocessTarget(clonePath, packageDir, 'dev', port);
      }
    }
  }

  const rootPackageJson = join(clonePath, 'package.json');
  if (await fileExists(rootPackageJson)) {
    const scripts = JSON.parse(await readFile(rootPackageJson, 'utf8')).scripts ?? {};
    if (scripts.dev) {
      return subprocessTarget(clonePath, null, 'dev', port);
    }
    if (scripts.start) {
      return subprocessTarget(clonePath, null, 'start', port);
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
