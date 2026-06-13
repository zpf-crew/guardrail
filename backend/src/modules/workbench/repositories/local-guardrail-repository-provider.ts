import type { IntentInput } from '../workbench.types.js';
import type { RepositoryContext, RepositoryContextProvider } from './repository-context-provider.js';
import { RepositoryScanner } from './repository-scanner.js';

interface LocalGuardrailRepositoryProviderOptions {
  rootDir: string;
}

export class LocalGuardrailRepositoryProvider implements RepositoryContextProvider {
  readonly #scanner: RepositoryScanner;

  constructor(options: LocalGuardrailRepositoryProviderOptions) {
    this.#scanner = new RepositoryScanner({ rootDir: options.rootDir });
  }

  async getContext(_repoId: string, intent?: IntentInput): Promise<RepositoryContext> {
    return this.#scanner.scan(intent ?? {
      prompt: '',
      feature: null,
      testTypes: ['UI / Browser'],
    });
  }
}
