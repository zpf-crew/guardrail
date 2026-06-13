import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { IntentInput, QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';
import type { RepositoryContext, SourceSnippet } from './repository-context-provider.js';

const execFileAsync = promisify(execFile);
const defaultMaxSnippetChars = 6000;
const maxSnippetLines = 160;
const maxRelatedFiles = 8;
const maxSpecDocs = 5;

type ScanIntent = Pick<IntentInput, 'prompt' | 'feature' | 'testTypes'>;
interface WeightedToken {
  value: string;
  weight: number;
}

export class RepositoryScanner {
  readonly #rootDir: string;
  readonly #maxSnippetChars: number;

  constructor(options: { rootDir: string; maxSnippetChars?: number }) {
    this.#rootDir = normalizeRootDir(options.rootDir);
    this.#maxSnippetChars = options.maxSnippetChars ?? defaultMaxSnippetChars;
  }

  async scan(intent: ScanIntent): Promise<RepositoryContext> {
    const repo = await this.#repoRef();
    const inventory = await this.#fileInventory();
    const sourceFiles = this.#rankFiles(
      inventory.flatMap(path => classifySourceFile(path)),
      intent,
      maxRelatedFiles,
    );
    const existingTestFiles = this.#rankFiles(
      inventory.flatMap(path => classifyTestFile(path)),
      intent,
      maxRelatedFiles,
    );
    const specDocs = this.#rankFiles(
      inventory.flatMap(path => classifySpecFile(path)),
      intent,
      maxSpecDocs,
    );
    const sourceSnippets = await this.#snippets(sourceFiles.slice(0, 5));

    return {
      repo,
      frontend: {
        startCommand: 'pnpm --dir frontend dev --host 127.0.0.1',
        healthUrl: 'http://127.0.0.1:5173',
        url: 'http://127.0.0.1:5173/onboarding',
        route: '/onboarding',
      },
      relatedFiles: [...sourceFiles, ...existingTestFiles],
      specDocs,
      qcCases: this.#seededQcCases(),
      sourceSnippets,
    };
  }

  async #repoRef(): Promise<RepoRef> {
    const branch = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: this.#rootDir })
      .then(result => result.stdout.trim())
      .catch(() => 'local');
    const commit = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: this.#rootDir })
      .then(result => result.stdout.trim())
      .catch(() => undefined);

    return { name: 'guardrail', path: this.#rootDir, branch, commit };
  }

  async #fileInventory(): Promise<string[]> {
    let output: string;
    try {
      const result = await execFileAsync('rg', ['--files'], { cwd: this.#rootDir });
      output = result.stdout;
    } catch (error) {
      throw new Error(
        'Repository scan failed: ripgrep (rg) is required to inventory repository files. Install ripgrep and ensure it is on PATH.',
        { cause: error },
      );
    }

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(path => !path.includes('/node_modules/'))
      .filter(path => !path.includes('/dist/'))
      .filter(path => !path.includes('/.artifacts/'));
  }

  #rankFiles(files: RelatedFile[], intent: ScanIntent, limit: number): RelatedFile[] {
    return files
      .map(file => ({ ...file, score: scoreFile(file.path, intent) }))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, limit)
      .map(({ score: _score, ...file }) => file);
  }

  async #snippets(files: RelatedFile[]): Promise<SourceSnippet[]> {
    const snippets: SourceSnippet[] = [];
    for (const file of files) {
      let text: string;
      try {
        text = await readFile(join(this.#rootDir, file.path), 'utf8');
      } catch {
        continue;
      }
      const lines = text.split('\n');
      const snippetText = buildSnippetText(lines, this.#maxSnippetChars);
      snippets.push({
        path: file.path,
        startLine: 1,
        endLine: snippetText.length === 0 ? 0 : snippetText.split('\n').length,
        summary: file.meta ?? 'Repository source snippet.',
        text: snippetText,
      });
    }
    return snippets;
  }

  #seededQcCases(): QCTestCase[] {
    return [{
      id: 'QC-ONB-001',
      feature: 'Onboarding',
      scenario: 'Complete onboarding with local repository and optional knowledge sources',
      expectedResult: 'The onboarding flow reaches repository scan progress or completion state.',
      priority: 'High',
      automationStatus: 'missing',
    }];
  }
}

function classifySourceFile(path: string): RelatedFile[] {
  if (classifyTestFile(path).length > 0) return [];
  if (classifySpecFile(path).length > 0) return [];
  if (!/\.(css|js|jsx|ts|tsx)$/.test(path)) return [];
  if (/\.d\.ts$/.test(path)) return [];
  return [{ path, kind: 'source', meta: 'Discovered from selected repository scan.' }];
}

function classifyTestFile(path: string): RelatedFile[] {
  if (!/(^|\/)(__tests__|tests?|specs?)\//i.test(path) && !/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(path)) return [];
  if (!/\.(js|jsx|ts|tsx)$/.test(path)) return [];
  return [{ path, kind: 'test', meta: 'Discovered existing test candidate.' }];
}

function classifySpecFile(path: string): RelatedFile[] {
  if (!/\.md$/.test(path)) return [];
  if (!/^(docs|guardrail-skills)\//.test(path)) return [];
  return [{ path, kind: 'spec', meta: 'Discovered product or architecture specification.' }];
}

function scoreFile(path: string, intent: ScanIntent): number {
  const tokens = intentTokens(intent);
  const searchablePath = searchable(path);
  const fileName = searchable(basename(path));
  let score = 0;

  for (const token of tokens) {
    if (fileName.includes(token.value)) score += 8 * token.weight;
    if (searchablePath.includes(token.value)) score += 3 * token.weight;
  }

  if (/\/pages\//.test(path)) score += 3;
  if (/\/data\//.test(path)) score += 2;
  if (/workbench|generate-tests/.test(searchablePath) && tokens.some(token => ['ui', 'browser'].includes(token.value))) score += 1;
  return score;
}

function intentTokens(intent: ScanIntent): WeightedToken[] {
  const promptTokens = tokenizePrompt(`${intent.prompt} ${intent.feature ?? ''}`, 3);
  const typeTokens = tokenizeTypes(intent.testTypes.join(' '), 1);
  const byValue = new Map<string, WeightedToken>();

  for (const token of [...promptTokens, ...typeTokens]) {
    const existing = byValue.get(token.value);
    if (!existing || existing.weight < token.weight) byValue.set(token.value, token);
  }

  return [...byValue.values()];
}

const promptStopwords = ['for', 'the', 'and', 'with', 'add', 'improve', 'test', 'tests', 'ui', 'browser'];
const typeStopwords = ['for', 'the', 'and', 'with', 'add', 'improve', 'test', 'tests'];

function tokenizePrompt(value: string, weight: number): WeightedToken[] {
  return tokenize(value, weight, promptStopwords);
}

function tokenizeTypes(value: string, weight: number): WeightedToken[] {
  return tokenize(value, weight, typeStopwords);
}

function tokenize(value: string, weight: number, stopwords: string[]): WeightedToken[] {
  return searchable(value)
    .split(' ')
    .filter(token => token.length >= 2)
    .filter(token => !stopwords.includes(token))
    .map(token => ({ value: token, weight }));
}

function searchable(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildSnippetText(lines: string[], maxChars: number): string {
  const boundedLines = lines.slice(0, maxSnippetLines);
  const included: string[] = [];
  let charCount = 0;

  for (const line of boundedLines) {
    const separatorLength = included.length === 0 ? 0 : 1;
    const nextLength = charCount + separatorLength + line.length;
    if (nextLength > maxChars) {
      if (included.length === 0 && maxChars > 0) return line.slice(0, maxChars);
      break;
    }
    included.push(line);
    charCount = nextLength;
  }

  return included.join('\n');
}

function normalizeRootDir(rootDir: string): string {
  if (basename(rootDir) === 'backend') return dirname(rootDir);
  return rootDir;
}
