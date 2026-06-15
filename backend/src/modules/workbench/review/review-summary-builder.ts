import { countUnresolvedPlanQuestions } from '../plan/resolve-plan-answers.js';
import type { GenerationResult, PlanApproval, ReviewSummary, TestPlan, TestRunResult } from '../workbench.types.js';

function diffStat(change: GenerationResult['changes'][number]): string {
  const adds = change.diff.filter(line => line.kind === 'add').length;
  const dels = change.diff.filter(line => line.kind === 'del').length;
  if (change.action === 'Add') return `+${adds}`;
  if (change.action === 'Delete') return `-${dels}`;
  return `~${adds + dels}`;
}

export function buildReviewSummary(
  input: { generation: GenerationResult; run: TestRunResult; plan?: TestPlan; approval?: PlanApproval },
  recommendation: string,
): ReviewSummary {
  const openQuestions = input.plan && input.approval
    ? countUnresolvedPlanQuestions(input.plan, input.approval)
    : 0;
  const added = input.generation.changes.filter(change => change.action === 'Add').length;
  const updated = input.generation.changes.filter(change => change.action === 'Update').length;
  const deleted = input.generation.changes.filter(change => change.action === 'Delete').length;
  const passed = input.run.matrix.filter(row => row.status === 'Passed').length;
  const total = input.run.matrix.length;
  const line = input.run.coverage.find(item => item.metric === 'Line coverage');
  const branch = input.run.coverage.find(item => item.metric === 'Branch coverage');

  const remainingRisk: ReviewSummary['remainingRisk'] = [];
  if (input.run.attention) {
    remainingRisk.push({ label: input.run.attention.kind, value: input.run.attention.reason, sentiment: 'bad' });
  }
  if (input.run.ui.outcome === 'Failed') {
    remainingRisk.push({ label: 'UI run', value: input.run.ui.command, sentiment: 'bad' });
  }
  if (input.run.unit.outcome === 'Failed') {
    remainingRisk.push({ label: 'Unit run', value: input.run.unit.command, sentiment: 'bad' });
  }
  if (input.run.ui.evidence.some(item => item.kind === 'screenshot')) {
    remainingRisk.push({ label: 'Evidence', value: 'Screenshot captured for manual review', sentiment: 'neutral' });
  }

  return {
    testsAdded: added,
    testsUpdated: updated,
    testsDeleted: deleted,
    testsPassing: total > 0 ? `${passed}/${total}` : '0/0',
    coverage: {
      lineDelta: (line?.after ?? 0) - (line?.before ?? 0),
      branchDelta: (branch?.after ?? 0) - (branch?.before ?? 0),
    },
    flakyTracked: input.run.matrix.filter(row => row.status === 'Flaky').length,
    filesChanged: input.generation.changes.map(change => ({
      path: change.file,
      diffStat: diffStat(change),
      changeKind: change.action === 'Add' ? 'add' : change.action === 'Delete' ? 'delete' : 'update',
    })),
    remainingRisk,
    openQuestions,
    recommendation,
  };
}
