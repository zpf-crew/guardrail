import type { WorkbenchSession } from '@/types/testlens';

/**
 * Serializes a workbench session to a Markdown test plan and triggers a
 * client-side download. Pure data → string, so it works offline (no backend).
 */
function buildMarkdown(s: WorkbenchSession): string {
  const lines: string[] = [];
  lines.push(`# Test Plan — ${s.repo.name}`);
  lines.push('');
  lines.push(`- **Branch:** \`${s.repo.branch}\``);
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

  if (s.review?.remainingRisk.length) {
    lines.push('## Remaining Risk');
    lines.push('');
    for (const r of s.review.remainingRisk) lines.push(`- ${r.label}: ${r.value}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function exportTestPlan(session: WorkbenchSession): void {
  const blob = new Blob([buildMarkdown(session)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-plan-${session.repo.name}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
