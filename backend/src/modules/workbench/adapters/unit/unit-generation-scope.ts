import type { BehaviorClassification, IsolationResult, TestPlan } from '../../workbench.types.js';

export interface UnitScopedBehavior {
  behavior: string;
  status: BehaviorClassification['status'];
  action: 'Add' | 'Update' | 'Delete';
  risk: BehaviorClassification['risk'];
  file: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unit';
}

function isUnitRelevant(classification: BehaviorClassification): boolean {
  return classification.suggestedTypes.length === 0
    || classification.suggestedTypes.includes('Unit')
    || classification.suggestedTypes.includes('Integration');
}

function actionForStatus(status: BehaviorClassification['status']): UnitScopedBehavior['action'] | null {
  if (status === 'Missing') return 'Add';
  if (status === 'Weak' || status === 'Suspicious') return 'Update';
  return null;
}

function resolveFile(behavior: string, plan: TestPlan, index: number, total: number): string {
  const primary = plan.filesToChange.find(file => /\.(test|spec)\.[cm]?[jt]sx?$/i.test(file))
    ?? plan.filesToChange[0]
    ?? `guardrail-tests/unit/${slugify(behavior)}.test.ts`;
  if (total === 1 && /\.(test|spec)\.[cm]?[jt]sx?$/i.test(primary)) return primary;
  const dir = primary.includes('/') ? primary.slice(0, primary.lastIndexOf('/')) : 'guardrail-tests/unit';
  return `${dir}/${slugify(behavior)}.test.ts`;
}

export function deriveUnitGenerationScope(isolation: IsolationResult, plan: TestPlan): UnitScopedBehavior[] {
  const wantsAdd = plan.proposedActions.some(action => action.action === 'add');
  const wantsUpdate = plan.proposedActions.some(action => action.action === 'update');
  const wantsAll = plan.proposedActions.some(action =>
    action.action === 'add' && action.label.includes('isolated behaviors'));

  const candidates = isolation.classifications.filter(classification => {
    if (!isUnitRelevant(classification)) return false;
    if (classification.status === 'Covered' || classification.status === 'Failed') return false;
    if (wantsAll) return true;
    if (wantsAdd && classification.status === 'Missing') return true;
    if (wantsUpdate && (classification.status === 'Weak' || classification.status === 'Suspicious')) return true;
    return false;
  });

  const scoped = candidates.map(classification => ({
    classification,
    action: actionForStatus(classification.status) ?? ('Add' as const),
  }));

  return scoped.map(({ classification, action }, index) => ({
    behavior: classification.behavior,
    status: classification.status,
    action,
    risk: classification.risk,
    file: resolveFile(classification.behavior, plan, index, scoped.length),
  }));
}
