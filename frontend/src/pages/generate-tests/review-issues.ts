import type { ReviewSummary, TestRunResult, TestType } from '@/types/testlens';

/** A non-passing test surfaced in the review "issues" list and the exported report. */
export interface ReviewIssue {
  title: string;
  type: TestType;
  kind: 'failed' | 'flaky' | 'skipped';
  reason: string;
  file: string;
  likelyCause?: string;
  suggestedFix?: string;
}

/**
 * Builds the full list of non-passing tests for review/export. Prefers the run matrix (which carries
 * every failed/flaky/**skipped** row with its own reason + file), enriched with the per-test analysis
 * from the backend `failures` list (likely cause / suggested fix). Falls back to `failures` alone when
 * no run matrix is available. This is why a skipped test no longer disappears from the report.
 */
export function buildReviewIssues(
  run: TestRunResult | null | undefined,
  failures: ReviewSummary['failures'],
): ReviewIssue[] {
  const detailByTitle = new Map(failures.map(failure => [failure.title, failure]));

  if (run?.matrix?.length) {
    return run.matrix
      .filter(row => row.status === 'Failed' || row.status === 'Flaky' || row.status === 'Skipped')
      .map(row => {
        const detail = detailByTitle.get(row.title);
        return {
          title: row.title,
          type: row.type,
          kind: row.status === 'Flaky' ? 'flaky' : row.status === 'Skipped' ? 'skipped' : 'failed',
          reason: row.reason ?? detail?.reason ?? 'No failure detail captured.',
          file: row.file,
          likelyCause: detail?.likelyCause,
          suggestedFix: detail?.suggestedFix,
        };
      });
  }

  return failures.map(failure => ({
    title: failure.title,
    type: failure.type,
    kind: failure.kind,
    reason: failure.reason,
    file: failure.file,
    likelyCause: failure.likelyCause,
    suggestedFix: failure.suggestedFix,
  }));
}
