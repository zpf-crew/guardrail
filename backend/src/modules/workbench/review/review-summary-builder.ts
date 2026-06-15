import { countUnresolvedPlanQuestions } from '../plan/resolve-plan-answers.js';
import type { GenerationResult, PlanApproval, ReviewSummary, TestFailure, TestPlan, TestRunResult } from '../workbench.types.js';

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

  // One issue row per failing/flaky test, each with its own reason and file — not a single collapsed
  // row. Enrich the test the run flagged for attention with its likely cause / suggested fix.
  const attention = input.run.attention;
  const failures: TestFailure[] = input.run.matrix
    .filter(row => row.status === 'Failed' || row.status === 'Flaky')
    .map(row => {
      const matchesAttention = attention && attention.testTitle === row.title;
      return {
        title: row.title,
        type: row.type,
        kind: row.status === 'Flaky' ? 'flaky' as const : 'failed' as const,
        reason: row.reason ?? attention?.reason ?? 'No failure detail captured.',
        file: row.file,
        ...(matchesAttention ? { likelyCause: attention.likelyCause, suggestedFix: attention.suggestedFix } : {}),
      };
    });

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
    failures,
    // remainingRisk is retained for genuine residual risk; per-test failures now live in `failures`.
    remainingRisk: [],
    openQuestions,
    recommendation,
  };
}
