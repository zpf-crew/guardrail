import type { IntentInput } from '../workbench.types.js';
import type { RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';
import { RepositoryScanner } from './repository-scanner.js';

interface LocalGuardrailRepositoryProviderOptions {
  rootDir: string;
}

export class LocalGuardrailRepositoryProvider implements RepositoryContextProvider {
  readonly #scanner: RepositoryScanner;
  readonly #supportedRepoIds = new Set(['guardrail', 'local']);

  constructor(options: LocalGuardrailRepositoryProviderOptions) {
    this.#scanner = new RepositoryScanner({ rootDir: options.rootDir });
  }

  async getContext(repoId: string, intent?: IntentInput): Promise<RepositoryContext> {
    if (!this.#supportedRepoIds.has(repoId)) {
      throw new Error(`Unsupported local Guardrail repository id "${repoId}". Supported ids: guardrail, local.`);
    }

    return this.#scanner.scan(intent ?? {
      prompt: '',
      feature: null,
      testTypes: ['UI / Browser'],
    });
  }
}
