import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { ModelProfile } from '../../../models/model.types.js';
import type { SkillContract } from '../skills/skill-contract-loader.js';
import {
  validateWorkbenchStepResult,
  type WorkbenchSchemaName,
} from '../validation/workbench-validators.js';

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
    const response = await client.chat(
      [
        { role: 'system', content: args.skill.content },
        {
          role: 'user',
          content: JSON.stringify(
            { schemaName: args.schemaName, context: args.context },
            null,
            2,
          ),
        },
      ],
      { temperature: 0, maxTokens: 8000, signal: args.signal },
    );

    const parsed = parseJsonObject(response.content);
    return validateWorkbenchStepResult(args.schemaName, parsed);
  }
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(
      `Model returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
