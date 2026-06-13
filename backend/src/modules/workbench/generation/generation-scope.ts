import type { BehaviorClassification, IsolationResult, TestPlan } from '../workbench.types.js';

export interface ScopedBehavior {
  behavior: string;
  status: BehaviorClassification['status'];
  action: 'Add' | 'Update' | 'Delete';
  risk: BehaviorClassification['risk'];
  file: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
}

function isUiRelevant(classification: BehaviorClassification): boolean {
  return classification.suggestedTypes.length === 0
    || classification.suggestedTypes.includes('UI / Browser');
}

function resolveFile(behavior: string, plan: TestPlan, index: number, total: number): string {
  const primary = plan.filesToChange[0] ?? 'guardrail-tests/ui/generated.feature';
  if (total === 1) return primary;
  const dir = primary.includes('/') ? primary.slice(0, primary.lastIndexOf('/')) : 'guardrail-tests/ui';
  return `${dir}/${slugify(behavior)}.feature`;
}

function actionForStatus(status: BehaviorClassification['status']): ScopedBehavior['action'] | null {
  if (status === 'Missing') return 'Add';
  if (status === 'Weak' || status === 'Suspicious') return 'Update';
  return null;
}

/** Deterministic list of behaviors the generate step should stage — mirrors approved plan actions. */
export function deriveGenerationScope(isolation: IsolationResult, plan: TestPlan): ScopedBehavior[] {
  const wantsAdd = plan.proposedActions.some(action => action.action === 'add');
  const wantsUpdate = plan.proposedActions.some(action => action.action === 'update');
  const wantsAll = plan.proposedActions.some(action =>
    action.action === 'add' && action.label.includes('isolated behaviors'));

  const candidates = isolation.classifications.filter(classification => {
    if (!isUiRelevant(classification)) return false;
    if (classification.status === 'Failed' || classification.status === 'Covered') return false;
    if (wantsAll) return true;
    if (wantsAdd && classification.status === 'Missing') return true;
    if (wantsUpdate && (classification.status === 'Weak' || classification.status === 'Suspicious')) return true;
    return false;
  });

  const scoped = candidates
    .map(classification => {
      const action = actionForStatus(classification.status) ?? 'Add';
      return { classification, action };
    });

  return scoped.map(({ classification, action }, index) => ({
    behavior: classification.behavior,
    status: classification.status,
    action,
    risk: classification.risk,
    file: resolveFile(classification.behavior, plan, index, scoped.length),
  }));
}
