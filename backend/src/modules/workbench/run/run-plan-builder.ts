import { validateUiBrowserRunPlan, type UiBrowserRunPlan } from '../validation/workbench-validators.js';
import { parseScenarioRunPlan } from '../adapters/ui-browser/ui-browser-scenario.js';

export async function buildRunPlan(input: {
  scenarioText: string;
  modelPlan: UiBrowserRunPlan | null;
  defaultRoute: string;
}): Promise<UiBrowserRunPlan> {
  if (input.modelPlan) {
    return validateUiBrowserRunPlan(input.modelPlan);
  }
  return validateUiBrowserRunPlan(parseScenarioRunPlan(input.scenarioText, input.defaultRoute));
}
