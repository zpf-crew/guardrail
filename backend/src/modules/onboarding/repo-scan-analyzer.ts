import { exec as execCallback } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { walkRepositoryFiles } from '../../lib/repo-file-walker.js';
import type { RepoScanFacts } from './onboarding.types.js';

const exec = promisify(execCallback);
const TEST_FILE_RE = /(^|\/)(__tests__|tests?|e2e|cypress|playwright)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i;
const SOURCE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift)$/i;
const MAX_SNIPPET_BYTES = 8000;

async function walk(root: string, dir = '', acc: string[] = [], limit = 6000): Promise<string[]> {
  return walkRepositoryFiles(root, dir, acc, limit);
}

function detectPackageManager(files: string[]): RepoScanFacts['packageManager'] {
  if (files.includes('pnpm-lock.yaml')) return 'pnpm';
  if (files.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

function detectStack(pkg: Record<string, unknown> | null, files: string[]): string[] {
  const deps = {
    ...(pkg?.dependencies as Record<string, string> | undefined),
    ...(pkg?.devDependencies as Record<string, string> | undefined),
  };
  const stack = new Set<string>();
  if (files.some(file => file.endsWith('.ts') || file.endsWith('.tsx'))) stack.add('TypeScript');
  if (deps.react) stack.add('React');
  if (deps.fastify) stack.add('Fastify');
  if (deps.express) stack.add('Express');
  if (deps.jest) stack.add('Jest');
  if (deps.vitest) stack.add('Vitest');
  if (deps['@testing-library/react']) stack.add('React Testing Library');
  if (deps['@playwright/test']) stack.add('Playwright');
  if (deps.cypress) stack.add('Cypress');
  return [...stack];
}

function scriptCommand(packageManager: RepoScanFacts['packageManager'], script: string): string {
  if (packageManager === 'pnpm') return `pnpm ${script}`;
  if (packageManager === 'yarn') return `yarn ${script}`;
  return `npm run ${script}`;
}

function detectCommands(pkg: Record<string, unknown> | null, packageManager: RepoScanFacts['packageManager']): RepoScanFacts['commands'] {
  const scripts = pkg?.scripts as Record<string, string> | undefined;
  if (!scripts) return {};
  return {
    test: scripts.test ? (packageManager === 'npm' ? 'npm test' : `${packageManager} test`) : undefined,
    coverage: scripts.coverage ? scriptCommand(packageManager, 'coverage') : scripts['test:coverage'] ? scriptCommand(packageManager, 'test:coverage') : undefined,
    typecheck: scripts.typecheck ? scriptCommand(packageManager, 'typecheck') : undefined,
    lint: scripts.lint ? scriptCommand(packageManager, 'lint') : undefined,
  };
}

function installCommand(packageManager: RepoScanFacts['packageManager']): string {
  if (packageManager === 'pnpm') return 'pnpm install --frozen-lockfile';
  if (packageManager === 'yarn') return 'yarn install --frozen-lockfile';
  return 'npm install --no-audit --no-fund';
}

function moduleNameFromPath(file: string): { name: string; pathPrefix: string } {
  const parts = file.split('/');
  const srcIndex = parts.findIndex(part => ['src', 'app', 'lib', 'components', 'pages'].includes(part));
  if (srcIndex >= 0 && parts[srcIndex + 1]) {
    const name = parts[srcIndex + 2] && ['services', 'routes', 'modules', 'features', 'pages', 'components'].includes(parts[srcIndex + 1])
      ? parts[srcIndex + 2]
      : parts[srcIndex + 1];
    const prefixEnd = parts.indexOf(name);
    return {
      name: name.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
      pathPrefix: `${parts.slice(0, Math.max(prefixEnd, 1)).join('/')}/`,
    };
  }
  return { name: 'Core', pathPrefix: '' };
}

function stripKnownExtension(file: string): string {
  return file.replace(/\.[cm]?[jt]sx?$/i, '');
}

function sourceMatchesImport(sourceFile: string, testFile: string, specifier: string): boolean {
  const sourceNoExt = stripKnownExtension(sourceFile);
  if (specifier.startsWith('.')) {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(testFile), specifier));
    return sourceNoExt === resolved || sourceNoExt === `${resolved}/index`;
  }

  const sourceBase = path.posix.basename(sourceNoExt).toLowerCase();
  return sourceBase === specifier.toLowerCase() || sourceNoExt.toLowerCase().endsWith(`/${specifier.toLowerCase()}`);
}

function findTestedSourceFiles(testFile: string, content: string | undefined, sourceFiles: string[]): string[] {
  const tested = new Set<string>();
  const importSpecifiers = [...(content ?? '').matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)]
    .map(match => match[1])
    .filter(Boolean);

  for (const specifier of importSpecifiers) {
    for (const sourceFile of sourceFiles) {
      if (sourceMatchesImport(sourceFile, testFile, specifier)) {
        tested.add(sourceFile);
      }
    }
  }

  if (!tested.size) {
    const testSubject = path.posix.basename(stripKnownExtension(testFile)).replace(/\.(test|spec)$/i, '').toLowerCase();
    for (const sourceFile of sourceFiles) {
      const sourceBase = path.posix.basename(stripKnownExtension(sourceFile)).toLowerCase();
      if (sourceBase === testSubject || sourceBase.includes(testSubject) || testSubject.includes(sourceBase)) {
        tested.add(sourceFile);
      }
    }
  }

  return [...tested];
}

function buildModules(sourceFiles: string[], testFiles: string[], testSnippets: Array<{ path: string; content: string }>): RepoScanFacts['modules'] {
  const modules = new Map<string, { name: string; pathPrefix: string; sourceCount: number; testCount: number }>();
  for (const file of sourceFiles) {
    const mod = moduleNameFromPath(file);
    const current = modules.get(mod.name) ?? { ...mod, sourceCount: 0, testCount: 0 };
    current.sourceCount += 1;
    modules.set(mod.name, current);
  }
  const snippetByPath = new Map(testSnippets.map(snippet => [snippet.path, snippet.content]));
  for (const file of testFiles) {
    const testedSources = findTestedSourceFiles(file, snippetByPath.get(file), sourceFiles);
    const testedModules = new Map<string, { name: string; pathPrefix: string }>();

    for (const sourceFile of testedSources) {
      const mod = moduleNameFromPath(sourceFile);
      testedModules.set(mod.name, mod);
    }

    if (!testedModules.size) {
      const fallback = moduleNameFromPath(file);
      testedModules.set(fallback.name, fallback);
    }

    for (const mod of testedModules.values()) {
      const current = modules.get(mod.name) ?? { ...mod, sourceCount: 0, testCount: 0 };
      current.testCount += 1;
      modules.set(mod.name, current);
    }
  }
  return [...modules.values()]
    .sort((a, b) => b.sourceCount + b.testCount - (a.sourceCount + a.testCount));
}

async function runCommand(cwd: string, command: string, timeout = 30_000): Promise<{ command: string; ok: boolean; output: string }> {
  try {
    const result = await exec(command, { cwd, timeout, maxBuffer: 240_000 });
    return { command, ok: true, output: `${result.stdout}\n${result.stderr}`.trim().slice(-5000) };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      command,
      ok: false,
      output: `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message ?? ''}`.trim().slice(-5000),
    };
  }
}

function parseCoverage(output: string): number | undefined {
  const matches = [...output.matchAll(/(?:All files|Statements|Lines)\s*[|:]\s*(\d+(?:\.\d+)?)/gi)];
  const value = matches.at(-1)?.[1];
  return value ? Math.max(0, Math.min(100, Number(value))) : undefined;
}

async function readSnippets(root: string, files: string[]): Promise<{ snippets: Array<{ path: string; content: string }>; skippedLargeFiles: number }> {
  const snippets: Array<{ path: string; content: string }> = [];
  let skippedLargeFiles = 0;
  for (const file of files) {
    const abs = path.join(root, file);
    try {
      const info = await stat(abs);
      if (!info.isFile()) continue;
      if (info.size > 200_000) {
        skippedLargeFiles += 1;
        continue;
      }
      const content = await readFile(abs, 'utf8');
      snippets.push({ path: file, content: content.slice(0, MAX_SNIPPET_BYTES) });
    } catch {
      // Ignore unreadable files; path-level evidence is still available.
    }
  }
  return { snippets, skippedLargeFiles };
}

export async function analyzeRepo(clonePath: string): Promise<RepoScanFacts> {
  const rootStat = await stat(clonePath);
  if (!rootStat.isDirectory()) {
    throw new Error('Repository clone path is not a directory');
  }

  const files = await walk(clonePath);
  const packageJson = await readFile(path.join(clonePath, 'package.json'), 'utf8')
    .then(raw => JSON.parse(raw) as Record<string, unknown>)
    .catch(() => null);

  const packageManager = detectPackageManager(files);
  const sourceFiles = files.filter(file => SOURCE_FILE_RE.test(file) && !TEST_FILE_RE.test(file));
  const testFiles = files.filter(file => TEST_FILE_RE.test(file));
  const sourceSnippetResult = await readSnippets(clonePath, sourceFiles);
  const testSnippetResult = await readSnippets(clonePath, testFiles);
  const commands = detectCommands(packageJson, packageManager);
  const hasPackageJson = files.includes('package.json');
  const hasNodeModules = await stat(path.join(clonePath, 'node_modules')).then(info => info.isDirectory()).catch(() => false);
  const installRun = hasPackageJson && !hasNodeModules && (commands.test || commands.coverage)
    ? await runCommand(clonePath, installCommand(packageManager), 120_000)
    : undefined;
  const canRunCommands = !installRun || installRun.ok;
  const testRun = commands.test && canRunCommands ? await runCommand(clonePath, commands.test) : undefined;
  const coverageRunBase = commands.coverage && canRunCommands ? await runCommand(clonePath, commands.coverage) : undefined;
  const coverageRun = coverageRunBase ? { ...coverageRunBase, coverage: parseCoverage(coverageRunBase.output) } : undefined;

  return {
    filesIndexed: files.length,
    sourceFiles,
    testFiles,
    sourceSnippets: sourceSnippetResult.snippets,
    testSnippets: testSnippetResult.snippets,
    skippedLargeFiles: sourceSnippetResult.skippedLargeFiles + testSnippetResult.skippedLargeFiles,
    modules: buildModules(sourceFiles, testFiles, testSnippetResult.snippets),
    detectedStack: detectStack(packageJson, files),
    packageManager,
    commands,
    installRun,
    testRun,
    coverageRun,
  };
}
