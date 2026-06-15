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

const MAX_TOKENS_BY_SCHEMA: Record<WorkbenchSchemaName, number> = {
  IsolationResult: 4_000,
  IsolationClassifications: 4_000,
  TestPlan: 4_000,
  TestPlanQuestions: 2_000,
  GenerationResult: 12_000,
  GenerationChanges: 12_000,
  TestRunResult: 4_000,
  ReviewSummary: 3_000,
  ReviewRecommendation: 2_000,
  UnitRunPlan: 2_000,
  UiBrowserScenarioPlan: 3_000,
};

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
  const json = extractFirstJsonObject(trimmed);
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(
      `Model returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractFirstJsonObject(value: string): string {
  if (value.startsWith('{')) return value;

  const start = value.indexOf('{');
  if (start < 0) return value;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return value;
}
