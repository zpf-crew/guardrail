import type { WorkbenchSession } from '@/types/testlens';
import { buildReviewIssues } from './review-issues';

/**
 * Serializes a workbench session to a Markdown test report and triggers a client-side download.
 * Includes the failing-test issues (reason + file + likely cause/fix) so the file can be handed to a
 * coding AI agent to fix the application code, then re-verified in Guardrail. Works offline (no backend).
 */
function buildMarkdown(s: WorkbenchSession): string {
  const lines: string[] = [];
  lines.push(`# Test Report — ${s.repo.name}`);
  lines.push('');
  lines.push(`- **Branch:** \`${s.repo.branch}\`${s.repo.commit ? ` (\`${s.repo.commit}\`)` : ''}`);
  if (s.repo.path) lines.push(`- **Repo path:** \`${s.repo.path}\``);
  lines.push(`- **Feature:** ${s.intent.feature ?? '—'}`);
  if (s.intent.prompt) lines.push(`- **Goal:** ${s.intent.prompt}`);
  lines.push('');

  if (s.review) {
    const r = s.review;
    lines.push('## Summary');
    lines.push(`> ${r.recommendation}`);
    lines.push('');
    lines.push(`- Added: ${r.testsAdded} · Updated: ${r.testsUpdated} · Deleted: ${r.testsDeleted}`);
    lines.push(`- Passing: ${r.testsPassing} · Coverage: +${r.coverage.lineDelta}% line / +${r.coverage.branchDelta}% branch`);
    lines.push('');
  }

  // The verify command lets a developer (or AI agent) reproduce the run after fixing.
  const verifyCommand = s.run?.unit.command && s.run.unit.outcome !== 'Skipped'
    ? s.run.unit.command
    : s.run?.ui.command;

  // Every non-passing test (failed/flaky/skipped) with its own reason + file, not just the flagged one.
  const issues = buildReviewIssues(s.run, s.review?.failures ?? []);
  if (issues.length) {
    lines.push('## Issues Found');
    lines.push('');
    lines.push('> Each test below encodes the expected behavior. The bug is almost always in the');
    lines.push('> **application/source code, not the test** — fix the source so the behavior holds. Do not');
    lines.push('> weaken or delete tests to make them pass.');
    lines.push('');
    if (verifyCommand) lines.push(`**Verify after fixing:** \`${verifyCommand}\``);
    lines.push('');
    for (const issue of issues) {
      lines.push(`### [${issue.kind}] ${issue.title}`);
      lines.push(`- **Type:** ${issue.type} · **Test file:** \`${issue.file}\``);
      lines.push(`- **Failure:** ${issue.reason}`);
      if (issue.likelyCause) lines.push(`- **Likely cause:** ${issue.likelyCause}`);
      if (issue.suggestedFix) lines.push(`- **Suggested fix:** ${issue.suggestedFix}`);
      lines.push('');
    }
  }

  if (s.generation?.changes.length) {
    lines.push('## Proposed Changes');
    lines.push('');
    lines.push('| Action | Type | Title | File |');
    lines.push('| --- | --- | --- | --- |');
    for (const c of s.generation.changes) {
      lines.push(`| ${c.action} | ${c.testType} | ${c.title} | \`${c.file}\` |`);
    }
    lines.push('');
  }

  if (s.review?.filesChanged.length) {
    lines.push('## Files Changed');
    lines.push('');
    for (const f of s.review.filesChanged) lines.push(`- \`${f.path}\` (${f.diffStat})`);
    lines.push('');
  }

  return lines.join('\n');
}

export function exportTestPlan(session: WorkbenchSession): void {
  const blob = new Blob([buildMarkdown(session)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-report-${session.repo.name}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
