import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { ModelProfile } from '../../../models/model.types.js';
import type { SkillContract } from '../skills/skill-contract-loader.js';
import {
  validateWorkbenchStepResult,
  type WorkbenchSchemaName,
} from '../validation/workbench-validators.js';
import { runReliableStructuredModel } from './reliable-model-runner.js';

interface StructuredModelRunnerOptions {
  modelConnect: ModelConnect | null;
}

interface RunStepArgs {
  profile: ModelProfile;
  skill: SkillContract;
  schemaName: WorkbenchSchemaName;
  context: unknown;
  signal: AbortSignal;
}

export class StructuredModelRunner {
  readonly #modelConnect: ModelConnect | null;

  constructor(options: StructuredModelRunnerOptions) {
    this.#modelConnect = options.modelConnect;
  }

  async runStep<TName extends WorkbenchSchemaName>(
    args: RunStepArgs & { schemaName: TName },
  ): Promise<ReturnType<typeof validateWorkbenchStepResult<TName>>> {
    if (!this.#modelConnect) {
      throw new Error(
        `LLM is not configured for ${args.skill.name}. Configure LLM_BASE_URL and LLM_API_KEY.`,
      );
    }

    const client = this.#modelConnect.getClient(args.profile);
    return runReliableStructuredModel({
      client,
      messagesForAttempt: validationError => [
        { role: 'system', content: args.skill.content },
        {
          role: 'user',
          content: JSON.stringify(
            validationError
              ? {
                schemaName: args.schemaName,
                context: args.context,
                validationError,
                retryHint: `Return only one valid ${args.schemaName} JSON object. Do not include analysis, prose, markdown, or code fences.`,
              }
              : { schemaName: args.schemaName, context: args.context },
            null,
            2,
          ),
        },
      ],
      chatOptions: { temperature: 0, maxTokens: 10000 },
      signal: args.signal,
      validate: parsed => validateWorkbenchStepResult(args.schemaName, parsed),
    });
  }
}
