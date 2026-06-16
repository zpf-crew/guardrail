import type { ModelConnect } from '../../model-connect/model-connect.service.js';
import type { ModelProfile } from '../../../models/model.types.js';
import type { SkillContract } from '../skills/skill-contract-loader.js';
import type { AgentIterationContext } from '../adapters/ui-browser/ui-browser-agent-context.js';
import {
  validateWorkbenchStepResult,
  validateUiBrowserAgentAction,
  type UiBrowserAgentAction,
  type UiBrowserExecutionPlan,
  type UiBrowserUserFlowPlan,
} from '../validation/workbench-validators.js';
import { normalizeAgentActionInput } from './normalize-ui-browser-agent-action.js';
import { runReliableStructuredModel } from './reliable-model-runner.js';

interface AgentModelRunnerOptions {
  modelConnect: ModelConnect | null;
}

interface DecideNextArgs {
  profile: ModelProfile;
  skill: SkillContract;
  context: AgentIterationContext;
  signal: AbortSignal;
}

interface PlanScenarioArgs {
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
    return runReliableStructuredModel({
      client,
      messagesForAttempt: validationError => [
        { role: 'system', content: args.skill.content },
        {
          role: 'user',
          content: JSON.stringify(
            validationError
              ? {
                schemaName: 'UiBrowserAgentAction',
                context: args.context,
                validationError,
                retryHint: 'Return only one valid UiBrowserAgentAction JSON object. Do not include analysis, prose, markdown, or code fences.',
              }
              : { schemaName: 'UiBrowserAgentAction', context: args.context },
            null,
            2,
          ),
        },
      ],
      chatOptions: { temperature: 0, maxTokens: 1500 },
      signal: args.signal,
      validate: parsed => validateUiBrowserAgentAction(
        normalizeAgentActionInput(parsed, args.context),
      ),
    });
  }

  async #runValidatedPlan<T>(
    args: PlanScenarioArgs,
    schemaName: 'UiBrowserUserFlowPlan' | 'UiBrowserExecutionPlan',
  ): Promise<T> {
    if (!this.#modelConnect) {
      throw new Error('LLM is not configured for UI browser planning.');
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
                schemaName,
                context: args.context,
                validationError,
                retryHint: `Return only one valid ${schemaName} JSON object. Do not include analysis, prose, markdown, or code fences.`,
              }
              : { schemaName, context: args.context },
            null,
            2,
          ),
        },
      ],
      chatOptions: { temperature: 0, maxTokens: 10000 },
      signal: args.signal,
      validate: parsed => validateWorkbenchStepResult(schemaName, parsed) as T,
    });
  }

  async planUiBrowserFlows(args: PlanScenarioArgs): Promise<UiBrowserUserFlowPlan> {
    return this.#runValidatedPlan<UiBrowserUserFlowPlan>(args, 'UiBrowserUserFlowPlan');
  }

  async planUiBrowserExecution(args: PlanScenarioArgs): Promise<UiBrowserExecutionPlan> {
    return this.#runValidatedPlan<UiBrowserExecutionPlan>(args, 'UiBrowserExecutionPlan');
  }
}
