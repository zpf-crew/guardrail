import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { ModelProfile } from '../../../models/model.types.js';
import type { SkillContract } from '../skills/skill-contract-loader.js';
import {
  validateUiBrowserAgentAction,
  type UiBrowserAgentAction,
} from '../validation/workbench-validators.js';

interface AgentModelRunnerOptions {
  modelConnect: ModelConnect | null;
}

interface DecideNextArgs {
  profile: ModelProfile;
  skill: SkillContract;
  context: unknown;
  signal: AbortSignal;
}

export class AgentModelRunner {
  readonly #modelConnect: ModelConnect | null;

  constructor(options: AgentModelRunnerOptions) {
    this.#modelConnect = options.modelConnect;
  }

  async decideNext(args: DecideNextArgs): Promise<UiBrowserAgentAction> {
    if (!this.#modelConnect) {
      throw new Error('LLM is not configured for agentic UI browser run.');
    }

    const client = this.#modelConnect.getClient(args.profile);
    const response = await client.chat(
      [
        { role: 'system', content: args.skill.content },
        {
          role: 'user',
          content: JSON.stringify({ schemaName: 'UiBrowserAgentAction', context: args.context }, null, 2),
        },
      ],
      { temperature: 0, maxTokens: 1500, signal: args.signal },
    );

    return validateUiBrowserAgentAction(parseJsonObject(response.content));
  }
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : trimmed;
  return JSON.parse(json);
}
