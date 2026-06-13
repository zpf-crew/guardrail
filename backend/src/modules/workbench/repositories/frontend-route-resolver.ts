import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { IntentInput } from '../workbench.types.js';

export interface ResolvedFrontendContext {
  startCommand?: string;
  healthUrl: string;
  url: string;
  route: string;
  routes: string[];
}

type ScanIntent = Pick<IntentInput, 'prompt' | 'feature' | 'testTypes'>;

async function fileExists(path: string): Promise<boolean> {
  return stat(path).then(info => info.isFile()).catch(() => false);
}

function tokenizeIntent(intent: ScanIntent): string[] {
  const raw = `${intent.prompt} ${intent.feature ?? ''}`.toLowerCase();
  return raw.split(/[^a-z0-9]+/).filter(token => token.length > 2);
}

function extractRoutesFromSource(source: string): string[] {
  const routes = new Set<string>();
  for (const match of source.matchAll(/path\s*=\s*["'](\/[^"']+)["']/g)) routes.add(match[1]!);
  for (const match of source.matchAll(/["'](\/[a-z0-9/_-]+)["']/g)) {
    if (match[1]!.length > 1) routes.add(match[1]!);
  }
  return [...routes];
}

function pickRoute(routes: string[], intent: ScanIntent): string {
  if (routes.length === 0) return '/';
  const tokens = tokenizeIntent(intent);
  const scored = routes.map(route => {
    const slug = route.toLowerCase().replace(/^\//, '');
    const score = tokens.reduce((sum, token) => sum + (slug.includes(token) ? 3 : 0), 0);
    return { route, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.route ?? routes[0] ?? '/';
}

async function detectPort(frontendDir: string): Promise<number> {
  const viteConfig = join(frontendDir, 'vite.config.ts');
  if (await fileExists(viteConfig)) {
    const text = await readFile(viteConfig, 'utf8');
    const match = text.match(/port\s*:\s*(\d{2,5})/);
    if (match) return Number(match[1]);
  }
  return 5173;
}

export async function resolveFrontendContext(
  rootDir: string,
  intent: ScanIntent,
): Promise<ResolvedFrontendContext | null> {
  const frontendDir = join(rootDir, 'frontend');
  if (!(await fileExists(join(frontendDir, 'package.json')))) return null;

  const routes = new Set<string>();
  const scanDir = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) await scanDir(fullPath);
      else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const text = await readFile(fullPath, 'utf8').catch(() => '');
        for (const route of extractRoutesFromSource(text)) routes.add(route);
      }
    }
  };
  await scanDir(join(frontendDir, 'src'));

  const routeList = [...routes];
  const route = pickRoute(routeList, intent);
  const port = await detectPort(frontendDir);
  const base = `http://127.0.0.1:${port}`;

  return {
    startCommand: 'pnpm --dir frontend dev --host 127.0.0.1',
    healthUrl: base,
    url: `${base}${route}`,
    route,
    routes: routeList.length > 0 ? routeList : [route],
  };
}
