import type { DashboardPayload, TestCase } from '@/types/testlens';
import { formatPercent } from './format-percent';

/**
 * Serializes a DashboardPayload to a Markdown report and triggers a client-side download.
 * The report doubles as a hand-off for a coding AI agent: it states the expected behavior and
 * the agent's note for each flagged test, framed so the agent fixes the application code (not the
 * tests) and re-verifies in Guardrail. Pure data → string, so it works offline with no backend.
 */

/** One flagged test rendered with the behavior + agent note an AI fixer needs. */
function renderTestCase(tc: TestCase): string[] {
  const out: string[] = [];
  out.push(`### ${tc.title}`);
  out.push(`- **Status:** ${tc.status} · **Risk:** ${tc.risk} · **Type:** ${tc.type} · **Feature/module:** ${tc.feature}`);
  out.push(`- **Expected behavior:** ${tc.description}`);
  if (tc.aiNote) out.push(`- **Agent note:** ${tc.aiNote.text}`);
  out.push('');
  return out;
}

function buildMarkdown(d: DashboardPayload): string {
  const lines: string[] = [];
  const m = d.metrics;

  lines.push(`# Testing Health Report — ${d.repo.name}`);
  lines.push('');
  lines.push(`- **Branch:** \`${d.repo.branch}\`${d.repo.commit ? ` (\`${d.repo.commit}\`)` : ''}`);
  if (d.repo.path) lines.push(`- **Repo path:** \`${d.repo.path}\``);
  lines.push(`- **Last scan:** ${d.lastScanAt}`);
  lines.push(`- **Files indexed:** ${d.filesIndexed.toLocaleString()}`);
  lines.push('');

  // Framing for a coding AI agent — the whole point of the export.
  lines.push('## How to use this report (for a coding AI agent)');
  lines.push('');
  lines.push('> You are fixing a software repository so its tested behavior holds. For each item under');
  lines.push('> **Behaviors to fix**, the test encodes the correct behavior — the bug is almost always in the');
  lines.push('> **application/source code, not the test**. Change the source so the described behavior is true.');
  lines.push('> Do **not** weaken or delete tests to make them pass. Items under **Missing coverage** need new');
  lines.push('> tests written for the described behavior. After fixing, push your changes and re-run the scan');
  lines.push('> in Guardrail to verify the behaviors now pass.');
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
  lines.push(`| Coverage | ${m.coverage.value == null ? 'not measured' : formatPercent(m.coverage.value)} |`);
  lines.push(`| High-risk open | ${m.highRiskOpen.value} |`);
  lines.push('');

  // Failing/flaky/suspicious behaviors → fix the application code.
  const toFix = d.testCases.filter(tc => tc.status === 'failed' || tc.status === 'flaky' || tc.status === 'suspicious');
  if (toFix.length) {
    lines.push('## Behaviors to fix (change application code)');
    lines.push('');
    for (const tc of toFix) lines.push(...renderTestCase(tc));
  }

  // Missing behaviors → new tests need to be written.
  const missing = d.testCases.filter(tc => tc.status === 'missing');
  if (missing.length) {
    lines.push('## Missing coverage (write new tests)');
    lines.push('');
    for (const tc of missing) lines.push(...renderTestCase(tc));
  }

  if (d.insights.length) {
    lines.push('## AI Insights');
    lines.push('');
    for (const ins of d.insights) {
      lines.push(`### [${ins.severity}] ${ins.title}`);
      lines.push(ins.description);
      const detail = [`Action: ${ins.action}`, ins.meta].filter(Boolean).join(' · ');
      lines.push(`_${detail}_`);
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
