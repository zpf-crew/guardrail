import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { ModelProfile } from '../../../models/model.types.js';
import type { SkillContract } from '../skills/skill-contract-loader.js';
import type { AgentIterationContext } from '../adapters/ui-browser/ui-browser-agent-context.js';
import {
  validateUiBrowserAgentAction,
  type UiBrowserAgentAction,
} from '../validation/workbench-validators.js';
import { normalizeAgentActionInput } from './normalize-ui-browser-agent-action.js';

interface AgentModelRunnerOptions {
  modelConnect: ModelConnect | null;
}

interface DecideNextArgs {
  profile: ModelProfile;
  skill: SkillContract;
  context: AgentIterationContext;
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
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const userContent = lastError
        ? JSON.stringify({
          schemaName: 'UiBrowserAgentAction',
          context: args.context,
          validationError: lastError,
          retryHint: 'Return one valid UiBrowserAgentAction JSON object with all required fields for the chosen kind.',
        }, null, 2)
        : JSON.stringify({ schemaName: 'UiBrowserAgentAction', context: args.context }, null, 2);

      const response = await client.chat(
        [
          { role: 'system', content: args.skill.content },
          { role: 'user', content: userContent },
        ],
        { temperature: 0, maxTokens: 1500, signal: args.signal },
      );

      try {
        const parsed = parseJsonObject(response.content);
        const normalized = normalizeAgentActionInput(parsed, args.context);
        return validateUiBrowserAgentAction(normalized);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt === 1) throw error;
      }
    }

    throw new Error(lastError ?? 'Agent decision failed.');
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
