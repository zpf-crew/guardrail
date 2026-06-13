import type { IntentInput } from '../workbench.types.js';
import type { GetRepositoryContextOptions, RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';
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

  async getContext(
    _repoId: string,
    _userId: string,
    intent?: IntentInput,
    options?: GetRepositoryContextOptions,
  ): Promise<RepositoryContext> {
    if (!this.#supportedRepoIds.has(_repoId)) {
      throw new Error(`Unsupported local Guardrail repository id "${_repoId}". Supported ids: guardrail, local.`);
    }

    return this.#scanner.scan(intent ?? {
      prompt: '',
      feature: null,
      testTypes: ['UI / Browser'],
    }, options);
  }
}
