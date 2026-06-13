import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import type { IntentInput, QCTestCase, RelatedFile, RepoRef } from '../workbench.types.js';
import type { RepositoryContext, SourceSnippet } from './repository-context-provider.js';

const execFileAsync = promisify(execFile);
const maxSnippetChars = 6000;
const maxSnippetLines = 160;

const sourceCandidates = [
  'frontend/src/pages/OnboardingPage.tsx',
  'frontend/src/data/onboardingMockData.ts',
  'frontend/src/pages/GenerateTestsPage.tsx',
  'frontend/src/data/workbench-api.ts',
];

const specDocCandidates = [
  'docs/superpowers/specs/2026-06-13-real-workbench-skill-pipeline-design.md',
  'docs/superpowers/specs/2026-06-11-guardrail-frontend-pages-design.md',
  'docs/superpowers/specs/2026-06-12-ui-browser-workbench-backend-design.md',
];

const testGlobArgs = [
  '-g',
  'frontend/src/**/*.test.ts',
  '-g',
  'frontend/src/**/*.test.tsx',
  '-g',
  'backend/src/**/*.test.ts',
];

type ScanIntent = Pick<IntentInput, 'prompt' | 'feature' | 'testTypes'>;

export class RepositoryScanner {
  readonly #rootDir: string;

  constructor(options: { rootDir: string }) {
    this.#rootDir = normalizeRootDir(options.rootDir);
  }

  async scan(intent: ScanIntent): Promise<RepositoryContext> {
    const repo = await this.#repoRef();
    const rankedSources = this.#rankSourceCandidates(intent);
    const sourceFiles = await this.#existingFiles(rankedSources, 'source', 'Discovered from selected repository scan.');
    const existingTestFiles = await this.#findTests(intent);
    const specDocs = await this.#existingFiles(
      this.#rankSpecDocCandidates(intent),
      'spec',
      'Discovered product or architecture specification.',
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

  #rankSourceCandidates(intent: ScanIntent): string[] {
    const terms = intentTerms(intent);
    if (terms.includes('onboarding')) return sourceCandidates;
    return sourceCandidates;
  }

  #rankSpecDocCandidates(intent: ScanIntent): string[] {
    const terms = intentTerms(intent);
    if (terms.includes('onboarding')) return specDocCandidates;
    return specDocCandidates;
  }

  async #existingFiles(paths: string[], kind: RelatedFile['kind'], meta: string): Promise<RelatedFile[]> {
    const files: RelatedFile[] = [];
    for (const path of paths) {
      const exists = await access(join(this.#rootDir, path)).then(() => true).catch(() => false);
      if (exists) files.push({ path, kind, meta });
    }
    return files;
  }

  async #findTests(intent: ScanIntent): Promise<RelatedFile[]> {
    const terms = intentTerms(intent);
    const output = await execFileAsync('rg', ['--files', ...testGlobArgs], { cwd: this.#rootDir })
      .then(result => result.stdout)
      .catch(() => '');

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(path => terms.includes('onboarding') ? /onboarding|workbench|generate/i.test(path) : true)
      .slice(0, 8)
      .map(path => ({
        path: relative(this.#rootDir, join(this.#rootDir, path)),
        kind: 'test' as const,
        meta: 'Discovered existing test candidate.',
      }));
  }

  async #snippets(files: RelatedFile[]): Promise<SourceSnippet[]> {
    const snippets: SourceSnippet[] = [];
    for (const file of files) {
      const text = await readFile(join(this.#rootDir, file.path), 'utf8');
      const lines = text.split('\n');
      const snippetLines = lines.slice(0, maxSnippetLines);
      snippets.push({
        path: file.path,
        startLine: 1,
        endLine: Math.min(lines.length, maxSnippetLines),
        summary: file.meta ?? 'Repository source snippet.',
        text: snippetLines.join('\n').slice(0, maxSnippetChars),
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

function intentTerms(intent: ScanIntent): string {
  return `${intent.prompt} ${intent.feature ?? ''} ${intent.testTypes.join(' ')}`.toLowerCase();
}

function normalizeRootDir(rootDir: string): string {
  if (basename(rootDir) === 'backend') return dirname(rootDir);
  return rootDir;
}
