import type { DashboardPayload } from '@/types/testlens';
import { formatPercent } from './format-percent';

/**
 * Serializes a DashboardPayload to a human-readable Markdown report and triggers
 * a client-side download. Pure data → string, so it works offline with no backend.
 */

function buildMarkdown(d: DashboardPayload): string {
  const lines: string[] = [];
  const m = d.metrics;

  lines.push(`# Testing Health Report — ${d.repo.name}`);
  lines.push('');
  lines.push(`- **Branch:** \`${d.repo.branch}\`${d.repo.commit ? ` (\`${d.repo.commit}\`)` : ''}`);
  lines.push(`- **Last scan:** ${d.lastScanAt}`);
  lines.push(`- **Files indexed:** ${d.filesIndexed.toLocaleString()}`);
  lines.push('');
  lines.push(`## Health: ${d.health.score}/${d.health.max} (${d.health.grade})`);
  if (d.health.note) lines.push(`> ${d.health.note}`);
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Total tests | ${m.totalTests.value} |`);
  lines.push(`| Passed | ${m.passed.value} |`);
  lines.push(`| Failed | ${m.failed.value} |`);
  lines.push(`| Flaky | ${m.flaky.value} |`);
  lines.push(`| Missing | ${m.missing.value} |`);
  lines.push(`| Suspicious | ${m.suspicious.value} |`);
  lines.push(`| Coverage | ${formatPercent(m.coverage.value)} |`);
  lines.push(`| High-risk open | ${m.highRiskOpen.value} |`);
  lines.push('');

  const flagged = d.testCases.filter(tc => tc.status !== 'passed');
  if (flagged.length) {
    lines.push('## Tests Needing Attention');
    lines.push('');
    lines.push('| ID | Status | Risk | Feature | Title |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const tc of flagged) {
      lines.push(`| ${tc.id} | ${tc.status} | ${tc.risk} | ${tc.feature} | ${tc.title} |`);
    }
    lines.push('');
  }

  if (d.insights.length) {
    lines.push('## AI Insights');
    lines.push('');
    for (const ins of d.insights) {
      lines.push(`### [${ins.severity}] ${ins.title}`);
      lines.push(ins.description);
      lines.push(`_Action: ${ins.action} · ${ins.relatedTestIds.length} related tests_`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function exportDashboardReport(d: DashboardPayload): void {
  const markdown = buildMarkdown(d);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const datePart = d.lastScanAt.slice(0, 10); // YYYY-MM-DD from ISO

  const a = document.createElement('a');
  a.href = url;
  a.download = `testing-report-${d.repo.name}-${datePart}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
