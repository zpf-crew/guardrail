import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RepositoryContext } from '../../repositories/repository-context-provider.js';

export type ExpectedUnitRunner = 'node:test' | 'vitest' | 'jest' | 'unknown';

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function detectFromText(text: string): ExpectedUnitRunner | null {
  if (/from\s+['"]vitest['"]|require\(['"]vitest['"]\)|\bvitest\b/i.test(text)) return 'vitest';
  if (/from\s+['"]node:test['"]|require\(['"]node:test['"]\)|node\s+--test/i.test(text)) return 'node:test';
  if (/from\s+['"]@jest\/globals['"]|require\(['"]@jest\/globals['"]\)|\bjest\b/i.test(text)) return 'jest';
  return null;
}

function detectFromPackageJson(packageJson: PackageJson): ExpectedUnitRunner {
  const text = [
    ...Object.values(packageJson.scripts ?? {}),
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ].join('\n');
  return detectFromText(text) ?? 'unknown';
}

export async function detectExpectedUnitRunner(repository: RepositoryContext): Promise<ExpectedUnitRunner> {
  for (const snippet of repository.sourceSnippets) {
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/i.test(snippet.path)) continue;
    const detected = detectFromText(snippet.text);
    if (detected) return detected;
  }

  try {
    const packageJson = JSON.parse(
      await readFile(join(repository.repo.path, 'package.json'), 'utf8'),
    ) as PackageJson;
    return detectFromPackageJson(packageJson);
  } catch {
    return 'unknown';
  }
}

function importedBindings(clause: string): string[] {
  const bindings: string[] = [];
  const defaultImport = clause.match(/^\s*([A-Za-z_$][\w$]*)/);
  if (defaultImport) bindings.push(defaultImport[1]!);
  const namespaceImport = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceImport) bindings.push(namespaceImport[1]!);
  const namedImports = clause.match(/\{([^}]+)\}/)?.[1];
  if (namedImports) {
    for (const item of namedImports.split(',')) {
      const binding = item.trim().split(/\s+as\s+/).at(-1)?.trim();
      if (binding && /^[A-Za-z_$][\w$]*$/.test(binding)) bindings.push(binding);
    }
  }
  return bindings;
}

function localProductionBindings(content: string): string[] {
  const bindings: string[] = [];
  const importPattern = /import\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g;
  for (const match of content.matchAll(importPattern)) {
    const clause = match[1] ?? '';
    const specifier = match[2] ?? '';
    const isLocal = specifier.startsWith('.')
      || specifier.startsWith('/')
      || specifier.startsWith('@/')
      || specifier.startsWith('~/')
      || specifier.startsWith('#');
    if (isLocal) bindings.push(...importedBindings(clause));
  }
  return [...new Set(bindings)];
}

export function validateGeneratedUnitContent(
  content: string,
  runner: ExpectedUnitRunner,
  file: string,
): void {
  if (!/\b(?:describe|it|test)\s*\(/.test(content)) {
    throw new Error(`Generated unit test has no test suite or test case: ${file}`);
  }
  if ((runner === 'vitest' || runner === 'jest') && /from\s+['"]node:test['"]|require\(['"]node:test['"]\)/.test(content)) {
    throw new Error(`Generated unit test uses node:test but repository runner is ${runner}: ${file}`);
  }
  if (runner === 'vitest' && !/from\s+['"]vitest['"]|require\(['"]vitest['"]\)/.test(content)) {
    throw new Error(`Generated unit test does not match Vitest style: ${file}`);
  }

  const tautologies = [
    /expect\(\s*true\s*\)\s*\.\s*toBe\(\s*true\s*\)/,
    /expect\(\s*false\s*\)\s*\.\s*toBe\(\s*false\s*\)/,
    /expect\(\s*(['"`][^'"`]*['"`]|-?\d+(?:\.\d+)?)\s*\)\s*\.\s*toBe\(\s*\1\s*\)/,
    /assert\.ok\(\s*true\b/,
    /assert\.(?:equal|strictEqual)\(\s*(['"`][^'"`]*['"`]|-?\d+(?:\.\d+)?|true|false)\s*,\s*\1\s*[,)]/,
  ];
  if (tautologies.some(pattern => pattern.test(content))) {
    throw new Error(`Generated unit test contains a tautological assertion instead of testing project behavior: ${file}`);
  }

  const productionBindings = localProductionBindings(content);
  if (productionBindings.length === 0) {
    throw new Error(`Generated unit test does not import a local production module: ${file}`);
  }

  const executableBody = content.replace(/^\s*import[\s\S]*?;\s*$/gm, '');
  const exercisedBinding = productionBindings.find(binding =>
    new RegExp(`\\b${binding.replace(/[$]/g, '\\$&')}\\b`).test(executableBody));
  if (!exercisedBinding) {
    throw new Error(`Generated unit test imports production code but does not exercise it: ${file}`);
  }
}
