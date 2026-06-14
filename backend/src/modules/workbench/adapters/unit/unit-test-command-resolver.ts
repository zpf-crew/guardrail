import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

type PackageManager = 'pnpm' | 'yarn' | 'npm';

export interface UnitTestCommand {
  command: string;
  cwd: string;
  packageRoot: string;
  generatedTestPath: string;
  focusedCommand: string;
  fullCommand: string;
}

async function fileExists(path: string): Promise<boolean> {
  return readFile(path).then(() => true).catch(() => false);
}

async function dirEntries(path: string): Promise<string[]> {
  return readdir(path).catch(() => []);
}

async function findPackageRoot(repoRoot: string, generatedFile: string): Promise<string> {
  let current = dirname(join(repoRoot, generatedFile));
  while (current.startsWith(repoRoot)) {
    if (await fileExists(join(current, 'package.json'))) return current;
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }
  return repoRoot;
}

async function detectPackageManager(repoRoot: string): Promise<PackageManager> {
  const entries = await dirEntries(repoRoot);
  if (entries.includes('pnpm-lock.yaml')) return 'pnpm';
  if (entries.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

function commandFor(packageManager: PackageManager, repoRoot: string, packageRoot: string, focusedFile: string): UnitTestCommand {
  const packageRel = relative(repoRoot, packageRoot) || '.';
  if (packageManager === 'pnpm') {
    const base = packageRel === '.' ? 'pnpm test' : `pnpm --dir ${packageRel} test`;
    return {
      command: `${base} -- ${focusedFile}`,
      cwd: repoRoot,
      packageRoot: packageRel,
      generatedTestPath: focusedFile,
      focusedCommand: `${base} -- ${focusedFile}`,
      fullCommand: base,
    };
  }
  if (packageManager === 'yarn') {
    const base = packageRel === '.' ? 'yarn test' : `yarn --cwd ${packageRel} test`;
    return {
      command: `${base} -- ${focusedFile}`,
      cwd: repoRoot,
      packageRoot: packageRel,
      generatedTestPath: focusedFile,
      focusedCommand: `${base} -- ${focusedFile}`,
      fullCommand: base,
    };
  }

  const base = packageRel === '.' ? 'npm test' : `npm --prefix ${packageRel} test`;
  return {
    command: `${base} -- ${focusedFile}`,
    cwd: repoRoot,
    packageRoot: packageRel,
    generatedTestPath: focusedFile,
    focusedCommand: `${base} -- ${focusedFile}`,
    fullCommand: base,
  };
}

export async function resolveUnitTestCommand(repoRoot: string, generatedFile: string): Promise<UnitTestCommand> {
  const packageRoot = await findPackageRoot(repoRoot, generatedFile);
  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  if (!packageJson.scripts?.test) {
    throw new Error(`No test script found for generated unit test: ${generatedFile}`);
  }
  const packageManager = await detectPackageManager(repoRoot);
  const focusedFile = relative(packageRoot, join(repoRoot, generatedFile));
  return commandFor(packageManager, repoRoot, packageRoot, focusedFile);
}

export function shouldFallbackToFullTestCommand(output: string): boolean {
  return /No tests found|No test files found|Unknown option|No files matching|ERR_UNKNOWN_OPTION|not found.*test|No matching tests/i.test(output);
}
