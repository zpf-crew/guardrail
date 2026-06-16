import type { RepoRecord } from '../repos/repos.types.js';
import { modelConnect } from '../model-connect/index.js';
import { analyzeRepo, moduleNameFromPath } from './repo-scan-analyzer.js';
import type {
  DashboardPayload,
  FileCoverage,
  InsightAction,
  OnboardingCommitResponse,
  OnboardingDraftInput,
  QCTestCaseInput,
  RepoScanFacts,
  RiskLevel,
  ScanLogEntry,
  ScanProgress,
  ScanReasoningResult,
  ScanSummary,
  Severity,
  TestStatus,
  TestType,
} from './onboarding.types.js';

const TEST_STATUSES = new Set<TestStatus>(['passed', 'failed', 'flaky', 'missing', 'suspicious']);
const TEST_TYPES = new Set<TestType>(['Unit', 'Integration', 'E2E', 'Contract', 'Regression', 'Edge Case', 'Security', 'UI / Browser', 'Visual Screenshot', 'Mobile']);
const RISK_LEVELS = new Set<RiskLevel>(['Low', 'Medium', 'High', 'Critical']);
const SEVERITIES = new Set<Severity>(['Critical', 'High', 'Medium', 'Low']);
const ACTIONS = new Set<InsightAction>(['Generate missing tests', 'Review suspicious tests', 'Explain failure', 'Create refactor plan', 'Open related test cases']);
const MODEL_SNIPPET_BUDGET_CHARS = 90_000;
const MODULE_MODEL_CONCURRENCY = 3;
const MODULE_SNIPPET_BUDGET_CHARS = 35_000;

function nowIso() {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function grade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'C+';
  if (score >= 60) return 'C';
  return 'D';
}

function estimateCoverageFromTestRatio(testCount: number, sourceCount: number): number {
  if (!sourceCount || !testCount) return 0;
  return clamp((testCount / sourceCount) * 100, 0, 95);
}

function parseJsonObject(content: string): ScanReasoningResult | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ScanReasoningResult;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function compactFacts(facts: RepoScanFacts, draft: OnboardingDraftInput) {
  let remainingSnippetBudget = MODEL_SNIPPET_BUDGET_CHARS;
  const fitSnippets = (snippets: Array<{ path: string; content: string }>) => {
    const selected: Array<{ path: string; content: string }> = [];
    for (const snippet of snippets) {
      if (remainingSnippetBudget <= 0) break;
      const content = snippet.content.slice(0, Math.min(2500, remainingSnippetBudget));
      remainingSnippetBudget -= content.length;
      selected.push({ path: snippet.path, content });
    }
    return selected;
  };
  const sourceSnippets = fitSnippets(facts.sourceSnippets);
  const testSnippets = fitSnippets(facts.testSnippets);

  return {
    filesIndexed: facts.filesIndexed,
    sourceFileCount: facts.sourceFiles.length,
    testFileCount: facts.testFiles.length,
    allSourceFiles: facts.sourceFiles,
    allTestFiles: facts.testFiles,
    scannedSourceSnippetCount: facts.sourceSnippets.length,
    scannedTestSnippetCount: facts.testSnippets.length,
    skippedLargeFiles: facts.skippedLargeFiles,
    modelContextSourceSnippetCount: sourceSnippets.length,
    modelContextTestSnippetCount: testSnippets.length,
    modelContextTruncated: sourceSnippets.length < facts.sourceSnippets.length || testSnippets.length < facts.testSnippets.length,
    sourceSnippets,
    testSnippets,
    modules: facts.modules,
    detectedStack: facts.detectedStack,
    packageManager: facts.packageManager,
    commands: facts.commands,
    installRun: facts.installRun ? { ...facts.installRun, output: facts.installRun.output.slice(-2500) } : null,
    testRun: facts.testRun ? { ...facts.testRun, output: facts.testRun.output.slice(-2500) } : null,
    coverageRun: facts.coverageRun ? { ...facts.coverageRun, output: facts.coverageRun.output.slice(-2500) } : null,
    productKnowledge: {
      docs: (draft.productDocs ?? []).map(doc => ({
        name: doc.file.name,
        type: doc.file.type,
        size: doc.file.size,
        snippet: doc.file.snippet?.slice(0, 1000),
      })),
      sources: draft.docSources ?? [],
    },
    qcFiles: (draft.qcFiles ?? []).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      snippet: file.snippet?.slice(0, 1000),
    })),
    qcCases: (draft.qcPreview ?? []).slice(0, 40),
  };
}

type ModelReasoningOutcome = {
  reasoning: ScanReasoningResult | null;
  status: 'used' | 'invalid-json' | 'fallback';
  message: string;
};

type ModuleScanTarget = RepoScanFacts['modules'][number] & {
  sourceSnippets: Array<{ path: string; content: string }>;
  testSnippets: Array<{ path: string; content: string }>;
};

type ModuleReasoningOutcome = ModelReasoningOutcome & {
  module: string;
};

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

function fitModuleSnippets(snippets: Array<{ path: string; content: string }>) {
  let remaining = MODULE_SNIPPET_BUDGET_CHARS;
  const selected: Array<{ path: string; content: string }> = [];
  for (const snippet of snippets) {
    if (remaining <= 0) break;
    const content = snippet.content.slice(0, Math.min(2500, remaining));
    remaining -= content.length;
    selected.push({ path: snippet.path, content });
  }
  return selected;
}

function buildModuleTargets(facts: RepoScanFacts): ModuleScanTarget[] {
  const modules = (facts.modules.length ? facts.modules : [{ name: 'Core', pathPrefix: '', sourceCount: facts.sourceFiles.length, testCount: facts.testFiles.length }])
    .filter(module => module.sourceCount > 0 || module.testCount > 0);

  return modules.map(module => {
    const match = (path: string) => {
      if (!module.pathPrefix) return true;
      return path.startsWith(module.pathPrefix) || path.toLowerCase().includes(module.name.toLowerCase().replace(/\s+/g, '-'));
    };
    return {
      ...module,
      sourceSnippets: fitModuleSnippets(facts.sourceSnippets.filter(snippet => match(snippet.path))),
      testSnippets: fitModuleSnippets(facts.testSnippets.filter(snippet => match(snippet.path))),
    };
  });
}

function userEvidenceForModule(draft: OnboardingDraftInput, moduleName: string) {
  const needle = moduleName.toLowerCase();
  const qcCases = (draft.qcPreview ?? []).filter(row => {
    const haystack = `${row.feature} ${row.scenario} ${row.expectedResult}`.toLowerCase();
    return haystack.includes(needle) || needle === 'core';
  });
  return {
    productKnowledge: {
      docs: (draft.productDocs ?? []).map(doc => ({
        name: doc.file.name,
        type: doc.file.type,
        size: doc.file.size,
        snippet: doc.file.snippet?.slice(0, 1000),
      })),
      sources: draft.docSources ?? [],
    },
    qcFiles: (draft.qcFiles ?? []).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      snippet: file.snippet?.slice(0, 1000),
    })),
    qcCases: qcCases.length ? qcCases : (draft.qcPreview ?? []).slice(0, 12),
  };
}

function fallbackModuleReasoning(module: ModuleScanTarget, facts: RepoScanFacts, draft: OnboardingDraftInput): ScanReasoningResult {
  const moduleQc = (draft.qcPreview ?? []).filter(row => {
    const haystack = `${row.feature} ${row.scenario} ${row.expectedResult}`.toLowerCase();
    return haystack.includes(module.name.toLowerCase());
  });
  const missingCases = qcToMissingCases(moduleQc.length ? moduleQc : []);
  const estimatedMissing = Math.max(missingCases.length, Math.max(0, Math.round(module.sourceCount / 8) - module.testCount));
  return {
    summary: {
      missingRecommended: estimatedMissing,
      suspiciousTests: draft.productDocs?.length || draft.docSources?.length ? Math.min(2, Math.floor(module.testCount / 8)) : 0,
      failedTests: facts.testRun && !facts.testRun.ok ? 1 : 0,
      flakyTests: 0,
      coverage: estimateCoverageFromTestRatio(module.testCount, module.sourceCount),
    },
    testCases: missingCases.length ? missingCases : estimatedMissing ? [{
      title: `Add behavior coverage for ${module.name}`,
      status: 'missing',
      type: 'Regression',
      feature: module.name,
      risk: module.sourceCount > module.testCount * 4 ? 'High' : 'Medium',
      description: `${module.name} has ${module.sourceCount} source files and ${module.testCount} test files; add tests for uncovered behavior paths.`,
      aiNote: 'Deterministic module fallback recommendation.',
    }] : [],
    insights: estimatedMissing ? [{
      severity: module.sourceCount > module.testCount * 4 ? 'High' : 'Medium',
      title: `${module.name} needs stronger test coverage`,
      description: `${module.name} has ${module.sourceCount} source files mapped to ${module.testCount} test files.`,
      action: 'Generate missing tests',
      meta: `${estimatedMissing} gaps · ${module.name}`,
    }] : [],
  };
}

async function analyzeModuleWithModel(module: ModuleScanTarget, facts: RepoScanFacts, draft: OnboardingDraftInput): Promise<ModuleReasoningOutcome> {
  const messages = [
    {
      role: 'system' as const,
      content:
        'You are Guardrail, a testing-first quality agent. Use deterministic evidence first. Return strict JSON only. Do not invent exact test names unless evidence supports them. Prefer behavior-level findings.',
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        task: `Analyze testing health for the ${module.name} module. Use code/test snippets plus product/QC evidence. Return strict JSON only.`,
        requiredShape: {
          summary: {
            missingRecommended: 'number',
            suspiciousTests: 'number',
            failedTests: 'number',
            flakyTests: 'number',
            coverage: 'number 0..100',
          },
          insights: [{ severity: 'Critical|High|Medium|Low', title: 'string', description: 'string', action: 'InsightAction', meta: 'string' }],
          testCases: [{ title: 'string', status: 'passed|failed|flaky|missing|suspicious', type: 'TestType', feature: 'string', risk: 'Low|Medium|High|Critical', description: 'string', aiNote: 'optional string' }],
        },
        evidence: {
          module: {
            name: module.name,
            pathPrefix: module.pathPrefix,
            sourceCount: module.sourceCount,
            testCount: module.testCount,
            sourceSnippets: module.sourceSnippets,
            testSnippets: module.testSnippets,
          },
          repo: {
            filesIndexed: facts.filesIndexed,
            detectedStack: facts.detectedStack,
            packageManager: facts.packageManager,
            commands: facts.commands,
            installRun: facts.installRun ? { ...facts.installRun, output: facts.installRun.output.slice(-1800) } : null,
            testRun: facts.testRun ? { ...facts.testRun, output: facts.testRun.output.slice(-1800) } : null,
            coverageRun: facts.coverageRun ? { ...facts.coverageRun, output: facts.coverageRun.output.slice(-1800) } : null,
          },
          userEvidence: userEvidenceForModule(draft, module.name),
        },
      }),
    },
  ];

  try {
    const result = await modelConnect.getThinker().chat(messages, { temperature: 0.2, maxTokens: 1800 });
    const reasoning = parseJsonObject(result.content);
    if (!reasoning) {
      return {
        module: module.name,
        reasoning: null,
        status: 'invalid-json',
        message: `${module.name} module Thinker response was invalid JSON; used deterministic fallback (${result.model}).`,
      };
    }
    return {
      module: module.name,
      reasoning,
      status: 'used',
      message: `${module.name} module analyzed by Thinker model (${result.model}).`,
    };
  } catch (error) {
    return {
      module: module.name,
      reasoning: null,
      status: 'fallback',
      message: `${module.name} module used deterministic fallback. ${error instanceof Error ? error.message : 'Unknown model error'}`,
    };
  }
}

function mergeReasoningResults(results: ScanReasoningResult[]): ScanReasoningResult {
  const summaries = results.map(result => result.summary ?? {});
  const avgCoverage = summaries.length
    ? summaries.reduce((sum, summary) => sum + (summary.coverage ?? 0), 0) / summaries.length
    : undefined;
  return {
    summary: {
      missingRecommended: summaries.reduce((sum, summary) => sum + (summary.missingRecommended ?? 0), 0),
      suspiciousTests: summaries.reduce((sum, summary) => sum + (summary.suspiciousTests ?? 0), 0),
      failedTests: Math.max(0, ...summaries.map(summary => summary.failedTests ?? 0)),
      flakyTests: summaries.reduce((sum, summary) => sum + (summary.flakyTests ?? 0), 0),
      coverage: avgCoverage,
    },
    insights: results.flatMap(result => result.insights ?? []).slice(0, 10),
    testCases: results.flatMap(result => result.testCases ?? []).slice(0, 24),
  };
}

async function aggregateWithModel(facts: RepoScanFacts, draft: OnboardingDraftInput, moduleOutcomes: ModuleReasoningOutcome[], fallback: ScanReasoningResult): Promise<ModelReasoningOutcome> {
  const messages = [
    {
      role: 'system' as const,
      content: 'You are Guardrail. Aggregate module-level testing analysis into one dashboard-ready strict JSON object. Deduplicate findings and prioritize actionable testing gaps.',
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        task: 'Aggregate module scan results into final repository testing intelligence.',
        requiredShape: {
          summary: {
            missingRecommended: 'number',
            suspiciousTests: 'number',
            failedTests: 'number',
            flakyTests: 'number',
            coverage: 'number 0..100',
          },
          insights: [{ severity: 'Critical|High|Medium|Low', title: 'string', description: 'string', action: 'InsightAction', meta: 'string' }],
          testCases: [{ title: 'string', status: 'passed|failed|flaky|missing|suspicious', type: 'TestType', feature: 'string', risk: 'Low|Medium|High|Critical', description: 'string', aiNote: 'optional string' }],
        },
        repoSummary: {
          filesIndexed: facts.filesIndexed,
          sourceFileCount: facts.sourceFiles.length,
          testFileCount: facts.testFiles.length,
          modules: facts.modules,
          detectedStack: facts.detectedStack,
          commands: facts.commands,
          productDocs: (draft.productDocs ?? []).map(doc => doc.file.name),
          docSources: draft.docSources ?? [],
          qcFiles: (draft.qcFiles ?? []).map(file => file.name),
          qcCaseCount: (draft.qcPreview ?? []).length,
        },
        moduleResults: moduleOutcomes.map(outcome => ({
          module: outcome.module,
          status: outcome.status,
          reasoning: outcome.reasoning,
        })),
      }),
    },
  ];

  try {
    const result = await modelConnect.getThinker().chat(messages, { temperature: 0.15, maxTokens: 2000 });
    const reasoning = parseJsonObject(result.content);
    if (!reasoning) {
      return {
        reasoning: fallback,
        status: 'invalid-json',
        message: `Aggregate Thinker response was invalid JSON; used deterministic merge (${result.model}).`,
      };
    }
    return {
      reasoning,
      status: 'used',
      message: `Aggregated module findings with Thinker model (${result.model}).`,
    };
  } catch (error) {
    return {
      reasoning: fallback,
      status: 'fallback',
      message: `Aggregate Thinker unavailable; used deterministic merge. ${error instanceof Error ? error.message : 'Unknown model error'}`,
    };
  }
}

function qcToMissingCases(qcCases: QCTestCaseInput[]) {
  return qcCases
    .filter(row => row.automationStatus !== 'automated')
    .slice(0, 8)
    .map(row => ({
      title: row.scenario,
      status: 'missing' as TestStatus,
      type: 'Regression' as TestType,
      feature: row.feature || 'Core',
      risk: row.priority === 'Critical' ? 'Critical' as RiskLevel : row.priority === 'High' ? 'High' as RiskLevel : 'Medium' as RiskLevel,
      description: row.expectedResult || `Manual QC case ${row.id} is not clearly covered by automated tests.`,
      aiNote: `QC ${row.id} is marked ${row.automationStatus}.`,
    }));
}

function fallbackReasoning(facts: RepoScanFacts, draft: OnboardingDraftInput): ScanReasoningResult {
  const qcCases = (draft.qcPreview?.length ? draft.qcPreview : (draft.qcFiles ?? []).map((file, index) => ({
    id: `QC-FILE-${index + 1}`,
    feature: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Imported QC',
    scenario: `Review QC context from ${file.name}`,
    expectedResult: 'Expected behavior is described in the imported QC artifact.',
    priority: 'Medium' as const,
    automationStatus: 'unknown' as const,
  })));
  const missingCases = qcToMissingCases(qcCases);
  const failedTests = facts.testRun && !facts.testRun.ok ? 1 : 0;
  const coverage = facts.coverageRun?.coverage ?? estimateCoverageFromTestRatio(facts.testFiles.length, facts.sourceFiles.length);

  return {
    summary: {
      missingRecommended: missingCases.length,
      suspiciousTests: draft.productDocs?.length || draft.docSources?.length ? Math.min(3, Math.max(1, Math.floor(qcCases.length / 8))) : 0,
      failedTests,
      flakyTests: failedTests ? 1 : 0,
      coverage,
    },
    testCases: missingCases,
    insights: [
      missingCases.length
        ? {
            severity: 'High',
            title: 'Missing automation for QC scenarios',
            description: `${missingCases.length} imported QC scenarios are not clearly covered by automated tests.`,
            action: 'Generate missing tests',
            meta: `${missingCases.length} gaps from QC`,
          }
        : {
            severity: 'Medium',
            title: 'Improve behavior-level test mapping',
            description: 'Guardrail found automated tests but limited QC/product evidence to confirm behavior coverage.',
            action: 'Open related test cases',
            meta: `${facts.testFiles.length} test files`,
          },
    ],
  };
}

function normalizeReasoning(reasoning: ScanReasoningResult | null, fallback: ScanReasoningResult): ScanReasoningResult {
  const source = reasoning ?? fallback;
  return {
    summary: { ...fallback.summary, ...source.summary },
    insights: source.insights?.length ? source.insights : fallback.insights,
    testCases: source.testCases?.length ? source.testCases : fallback.testCases,
  };
}

function buildBaseAutomatedCases(facts: RepoScanFacts): DashboardPayload['testCases'] {
  const commandFailed = facts.testRun?.ok === false;
  const commandPassed = facts.testRun?.ok === true;
  return facts.testFiles.slice(0, 12).map((file, index) => {
    // Feature = the module this test file actually lives in (path-derived), not a positional guess.
    const feature = moduleNameFromPath(file).name;
    const status = commandPassed ? 'passed' as TestStatus : commandFailed ? 'failed' as TestStatus : 'missing' as TestStatus;
    // Risk reflects the real run signal: a failing suite is High, an un-runnable suite is Medium,
    // a passing suite is Low. No positional assignment.
    const risk: RiskLevel = commandFailed ? 'High' : commandPassed ? 'Low' : 'Medium';
    return {
      id: `T-${String(index + 1).padStart(3, '0')}`,
      title: file.split('/').at(-1)?.replace(/\.(test|spec)\.[^.]+$/i, '').replace(/[-_]/g, ' ') || `Automated test ${index + 1}`,
      status,
      type: file.includes('playwright') || file.includes('cypress') || file.includes('e2e') ? 'UI / Browser' as TestType : 'Unit' as TestType,
      feature,
      risk,
      lastRunAt: facts.testRun ? nowIso() : null,
      // Initial scan executes the suite once; emit that single real data point, never a fabricated history.
      recentRuns: commandPassed ? [1] as (0 | 1)[] : commandFailed ? [0] as (0 | 1)[] : [],
      description: `Discovered from ${file}.`,
      aiNote: commandFailed
        ? { text: `Test command failed: ${facts.testRun?.command}`, tone: 'warn' as const }
        : undefined,
    };
  });
}

/**
 * Expands a per-file coverage report with the source files it omitted. A classified source file that a
 * successful coverage run never touched was never exercised by a test, so it counts as 0% covered —
 * the standard definition of repo-wide coverage (untested code is 0%, not "unknown").
 */
export function buildEffectiveFileCoverage(reported: FileCoverage[], sourceFiles: string[]): FileCoverage[] {
  const byPath = new Map<string, FileCoverage>();
  for (const file of reported) byPath.set(file.path, file);
  for (const source of sourceFiles) {
    if (!byPath.has(source)) byPath.set(source, { path: source, line: 0, branch: 0 });
  }
  return [...byPath.values()];
}

/** Average per-file coverage up to each module, so the module bars reflect real per-file data. */
export function aggregateModuleCoverage(files: FileCoverage[]): Map<string, { line: number; branch: number }> {
  const totals = new Map<string, { line: number; branch: number; count: number }>();
  for (const file of files) {
    const name = moduleNameFromPath(file.path).name;
    const current = totals.get(name) ?? { line: 0, branch: 0, count: 0 };
    current.line += file.line;
    current.branch += file.branch;
    current.count += 1;
    totals.set(name, current);
  }
  const averaged = new Map<string, { line: number; branch: number }>();
  for (const [name, total] of totals) {
    averaged.set(name, { line: Math.round(total.line / total.count), branch: Math.round(total.branch / total.count) });
  }
  return averaged;
}

function buildDashboard(repo: RepoRecord, facts: RepoScanFacts, draft: OnboardingDraftInput, reasoning: ScanReasoningResult): { summary: ScanSummary; dashboard: DashboardPayload } {
  const automatedTestsFound = facts.testFiles.length;
  const productDocsIndexed = (draft.productDocs ?? []).length + (draft.docSources ?? []).length;
  const qcCasesImported = Math.max((draft.qcPreview ?? []).length, (draft.qcFiles ?? []).length);
  // Coverage counts as "measured" only when the coverage command produced real data — either the
  // repo-level number from stdout, or per-file data from the coverage report. The model's coverage
  // guess is never surfaced; unmeasured stays null ("not measured").
  // With a per-file report, source files absent from it were never exercised → 0% (honest repo-wide
  // coverage and 0% module bars). Without a per-file report we can only trust the stdout total.
  const reportedFiles = facts.coverageRun?.files ?? [];
  const haveFileReport = reportedFiles.length > 0;
  const effectiveFileCoverage = haveFileReport ? buildEffectiveFileCoverage(reportedFiles, facts.sourceFiles) : [];
  const moduleCoverage = aggregateModuleCoverage(effectiveFileCoverage);
  const stdoutCoverage = facts.coverageRun?.ok && facts.coverageRun.coverage !== undefined
    ? clamp(facts.coverageRun.coverage, 0, 100)
    : null;
  const repoWideCoverage = effectiveFileCoverage.length
    ? clamp(effectiveFileCoverage.reduce((sum, file) => sum + file.line, 0) / effectiveFileCoverage.length, 0, 100)
    : null;
  const measuredCoverage = haveFileReport ? repoWideCoverage : stdoutCoverage;
  const modelContextTruncated = facts.sourceSnippets.reduce((sum, snippet) => sum + Math.min(2500, snippet.content.length), 0)
    + facts.testSnippets.reduce((sum, snippet) => sum + Math.min(2500, snippet.content.length), 0) > MODEL_SNIPPET_BUDGET_CHARS;

  const automatedCases = buildBaseAutomatedCases(facts);
  const modelCases = (reasoning.testCases ?? []).slice(0, 12).map((tc, index) => {
    const status = tc.status && TEST_STATUSES.has(tc.status) ? tc.status : 'missing';
    const type = tc.type && TEST_TYPES.has(tc.type) ? tc.type : 'Regression';
    const risk = tc.risk && RISK_LEVELS.has(tc.risk) ? tc.risk : 'Medium';
    return {
      id: `T-${String(automatedCases.length + index + 1).padStart(3, '0')}`,
      title: tc.title || `Recommended test ${index + 1}`,
      status,
      type,
      feature: tc.feature || 'Core',
      risk,
      // Model-recommended cases are not executed during the scan — no run timestamp, no run history.
      lastRunAt: null,
      recentRuns: [],
      description: tc.description || 'Behavior-level test recommendation from initial scan.',
      aiNote: tc.aiNote ? { text: tc.aiNote, tone: status === 'passed' ? 'info' as const : 'warn' as const } : undefined,
    };
  });
  const testCases = [...automatedCases, ...modelCases];
  const fallbackRelatedIds = testCases.filter(tc => tc.status !== 'passed').map(tc => tc.id).slice(0, 4);
  const insights = (reasoning.insights ?? []).slice(0, 6).map((insight, index) => ({
    id: `I-${String(index + 1).padStart(3, '0')}`,
    severity: insight.severity && SEVERITIES.has(insight.severity) ? insight.severity : 'Medium',
    title: insight.title || 'Testing improvement opportunity',
    description: insight.description || 'Guardrail found a behavior that would benefit from stronger automated evidence.',
    action: insight.action && ACTIONS.has(insight.action) ? insight.action : 'Generate missing tests',
    relatedTestIds: fallbackRelatedIds.length ? fallbackRelatedIds : testCases.slice(0, 2).map(tc => tc.id),
    meta: insight.meta,
  }));

  // Single source of truth: every status metric counts the exact cases rendered in the explorer,
  // so the headline can never disagree with the list below it.
  const countStatus = (status: TestStatus) => testCases.filter(tc => tc.status === status).length;
  const passed = countStatus('passed');
  const failedTests = countStatus('failed');
  const flakyTests = countStatus('flaky');
  const missingRecommended = countStatus('missing');
  const suspiciousTests = countStatus('suspicious');
  const highRiskOpen = testCases.filter(tc => (tc.risk === 'High' || tc.risk === 'Critical') && tc.status !== 'passed').length;

  // Health = neutral baseline + coverage reward − capped finding penalties + evidence bonus.
  // The baseline keeps a low-coverage-but-not-broken repo off the floor, while real coverage still
  // moves the score and findings are capped so no single category can sink it to zero on its own.
  // (Coverage uses a structural proxy when real coverage is absent — for scoring only, never displayed.)
  const coverageBasis = measuredCoverage ?? estimateCoverageFromTestRatio(facts.testFiles.length, facts.sourceFiles.length);
  const HEALTH_BASELINE = 45;
  const coverageReward = Math.round(coverageBasis * 0.45);
  const healthPenalty = Math.min(50, failedTests * 8 + flakyTests * 5 + suspiciousTests * 4 + missingRecommended * 2);
  const evidenceBonus = Math.min(10, productDocsIndexed + qcCasesImported);
  const healthScore = clamp(HEALTH_BASELINE + coverageReward - healthPenalty + evidenceBonus, 0, 100);

  const structure = facts.modules.length ? facts.modules : [{ name: 'Core', pathPrefix: '', sourceCount: facts.sourceFiles.length, testCount: facts.testFiles.length }];

  // Attribute findings to the module each case belongs to (from its real feature), not by row position.
  // Cases whose feature matches no module fall back to a Core bucket rather than being dumped on row 0.
  const moduleNames = new Set(structure.map(mod => mod.name));
  const resolveModule = (feature: string) => (moduleNames.has(feature) ? feature : 'Core');
  const tallyByModule = (status: TestStatus) => {
    const counts = new Map<string, number>();
    for (const tc of testCases) {
      if (tc.status !== status) continue;
      const key = resolveModule(tc.feature);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const missingByModule = tallyByModule('missing');
  const failedByModule = tallyByModule('failed');
  const flakyByModule = tallyByModule('flaky');
  const suspiciousByModule = tallyByModule('suspicious');
  const needsCoreRow = !moduleNames.has('Core')
    && [missingByModule, failedByModule, flakyByModule, suspiciousByModule].some(map => map.has('Core'));
  const heatmapModules = needsCoreRow
    ? [...structure, { name: 'Core', pathPrefix: '', sourceCount: 0, testCount: 0 }]
    : structure;
  const heatValue = (map: Map<string, number>, moduleName: string) => Math.min(3, map.get(moduleName) ?? 0) as 0 | 1 | 2 | 3;

  const dashboard: DashboardPayload = {
    repo: {
      name: repo.name,
      path: repo.clonePath ?? '',
      branch: repo.currentBranch ?? repo.defaultBranch,
      commit: repo.commitSha ?? undefined,
    },
    lastScanAt: nowIso(),
    filesIndexed: facts.filesIndexed,
    health: {
      score: healthScore,
      max: 100,
      grade: grade(healthScore),
      trend: { value: 0, sentiment: 'neutral', basis: 'initial scan' },
      note: missingRecommended || suspiciousTests ? 'Initial scan found gaps to review.' : 'Initial scan completed with no critical gaps found.',
    },
    metrics: {
      totalTests: { value: testCases.length, trend: { value: testCases.length, sentiment: 'good', basis: 'initial scan' } },
      passed: { value: passed, trend: { value: passed, sentiment: 'good', basis: 'initial scan' } },
      failed: { value: failedTests, trend: { value: failedTests, sentiment: failedTests ? 'bad' : 'neutral', basis: 'initial scan' } },
      flaky: { value: flakyTests, trend: { value: flakyTests, sentiment: flakyTests ? 'bad' : 'neutral', basis: 'initial scan' } },
      missing: { value: missingRecommended, trend: { value: missingRecommended, sentiment: missingRecommended ? 'bad' : 'neutral', basis: 'initial scan' } },
      suspicious: { value: suspiciousTests, trend: { value: suspiciousTests, sentiment: suspiciousTests ? 'bad' : 'neutral', basis: 'initial scan' } },
      coverage: {
        value: measuredCoverage,
        isPercent: true,
        trend: {
          value: measuredCoverage ?? 0,
          sentiment: measuredCoverage == null ? 'neutral' : measuredCoverage >= 70 ? 'good' : 'bad',
          basis: measuredCoverage == null ? 'not measured' : 'initial scan',
        },
      },
      highRiskOpen: { value: highRiskOpen, trend: { value: 0, sentiment: 'neutral', basis: 'initial scan' } },
    },
    testCases,
    insights,
    structure: structure.map(mod => ({
      pathPrefix: mod.pathPrefix,
      name: mod.name,
      // Real per-module line coverage when the coverage report has per-file data; null ("not measured") otherwise.
      coverage: moduleCoverage.get(mod.name)?.line ?? null,
      counts: [
        { label: 'Unit', count: mod.testCount, kind: 'unit' },
        { label: 'Missing', count: missingByModule.get(mod.name) ?? 0, kind: 'missing' },
      ],
    })),
    coverage: structure.map(mod => {
      const cov = moduleCoverage.get(mod.name);
      return { module: mod.name, line: cov?.line ?? null, branch: cov?.branch ?? null };
    }),
    riskHeatmap: {
      columns: ['Failed', 'Flaky', 'Missing', 'Suspect'],
      rows: heatmapModules.map(mod => ({
        module: mod.name,
        values: [
          heatValue(failedByModule, mod.name),
          heatValue(flakyByModule, mod.name),
          heatValue(missingByModule, mod.name),
          heatValue(suspiciousByModule, mod.name),
        ],
      })),
    },
    activity: [
      { id: 'A-1', state: 'done', title: `Scanned repository ${repo.name}`, at: nowIso(), detail: `${facts.filesIndexed.toLocaleString()} files indexed` },
      { id: 'A-2', state: 'done', title: 'Detected test framework and commands', at: nowIso(), detail: facts.detectedStack.join(', ') || 'No framework detected' },
      { id: 'A-3', state: 'done', title: 'Imported product knowledge and QC cases', at: nowIso(), detail: `${productDocsIndexed} docs/sources · ${qcCasesImported} QC cases` },
      { id: 'A-4', state: 'done', title: 'Audited scan context', at: nowIso(), detail: `${facts.sourceFiles.length} source files · ${facts.testFiles.length} test files · ${facts.modules.length} modules · context ${modelContextTruncated ? 'budgeted' : 'complete'}` },
      { id: 'A-5', state: 'done', title: 'Generated initial testing insights', at: nowIso(), detail: `${insights.length} recommendations` },
    ],
  };

  return {
    summary: {
      automatedTestsFound,
      qcCasesImported,
      productDocsIndexed,
      missingRecommended,
      suspiciousTests,
      failedTests,
      flakyTests,
      coverage: measuredCoverage,
    },
    dashboard,
  };
}

function buildLogs(
  facts: RepoScanFacts,
  draft: OnboardingDraftInput,
  summary: ScanSummary,
  moduleOutcomes: ModuleReasoningOutcome[],
  aggregateOutcome: ModelReasoningOutcome,
): ScanLogEntry[] {
  const at = nowIso();
  const modelContextTruncated = facts.sourceSnippets.reduce((sum, snippet) => sum + Math.min(2500, snippet.content.length), 0)
    + facts.testSnippets.reduce((sum, snippet) => sum + Math.min(2500, snippet.content.length), 0) > MODEL_SNIPPET_BUDGET_CHARS;
  const usedCount = moduleOutcomes.filter(outcome => outcome.status === 'used').length;
  const fallbackCount = moduleOutcomes.length - usedCount;
  const commandSummary = [
    facts.commands.test ? `test=${facts.commands.test}` : 'test=not detected',
    facts.commands.coverage ? `coverage=${facts.commands.coverage}` : 'coverage=not detected',
    facts.commands.typecheck ? `typecheck=${facts.commands.typecheck}` : null,
    facts.commands.lint ? `lint=${facts.commands.lint}` : null,
  ].filter(Boolean).join(' · ');
  const moduleNames = facts.modules.map(module => module.name).join(', ') || 'Core';
  const batchCount = Math.ceil(moduleOutcomes.length / MODULE_MODEL_CONCURRENCY);
  const productDocCount = (draft.productDocs ?? []).length;
  const docSourceCount = (draft.docSources ?? []).length;
  const qcFileCount = (draft.qcFiles ?? []).length;
  const qcRowCount = (draft.qcPreview ?? []).length;
  return [
    { at, level: 'info', message: `Analyzing repository structure — ${facts.filesIndexed.toLocaleString()} files indexed across the cloned repo` },
    { at, level: 'info', message: `Classified ${facts.sourceFiles.length} source files and ${facts.testFiles.length} test files` },
    { at, level: facts.detectedStack.length ? 'ok' : 'warn', message: facts.detectedStack.length ? `Detected ${facts.detectedStack.join(', ')}` : 'No known test framework detected' },
    { at, level: 'info', message: `Package manager: ${facts.packageManager}; commands: ${commandSummary}` },
    { at, level: 'ok', message: `Read ${facts.sourceSnippets.length} source files and ${facts.testSnippets.length} test files for scan evidence${facts.skippedLargeFiles ? `; skipped ${facts.skippedLargeFiles} large files` : ''}` },
    { at, level: facts.testFiles.length ? 'ok' : 'warn', message: `Found ${facts.testFiles.length.toLocaleString()} automated test files` },
    { at, level: 'ok', message: `Parsed ${(draft.productDocs ?? []).length} product docs and ${(draft.docSources ?? []).length} named sources` },
    { at, level: 'ok', message: `Imported ${(draft.qcPreview ?? []).length} parsed QC rows from ${(draft.qcFiles ?? []).length} QC files` },
    { at, level: 'ok', message: `Mapped ${facts.modules.length} source modules to test files: ${moduleNames}` },
    facts.installRun
      ? { at, level: facts.installRun.ok ? 'ok' : 'warn', message: `${facts.installRun.ok ? 'Installed' : 'Failed to install'} repository dependencies: ${facts.installRun.command}` }
      : { at, level: 'info', message: 'Dependency install skipped; existing workspace dependencies available or no package commands detected' },
    { at, level: facts.testRun?.ok === false ? 'warn' : facts.testRun?.ok ? 'ok' : 'info', message: facts.testRun ? `${facts.testRun.ok ? 'Passed' : 'Failed'} test command: ${facts.testRun.command}` : 'No test command detected or runnable' },
    { at, level: facts.coverageRun?.ok === false || (facts.coverageRun && facts.coverageRun.coverage === undefined) ? 'warn' : facts.coverageRun?.ok ? 'ok' : 'info', message: facts.coverageRun ? `${facts.coverageRun.ok ? 'Ran' : 'Failed'} coverage command: ${facts.coverageRun.command}${facts.coverageRun.coverage === undefined ? ' · coverage not parsed' : ` · ${facts.coverageRun.coverage}% line coverage`}` : 'No coverage command detected or runnable; estimated coverage' },
    { at, level: 'info', message: `Analyzing all ${moduleOutcomes.length} modules with Thinker model concurrency ${MODULE_MODEL_CONCURRENCY} across ${batchCount} parallel batch${batchCount === 1 ? '' : 'es'}` },
    ...moduleOutcomes.map(outcome => ({
      at,
      level: outcome.status === 'used' ? 'ok' as const : 'warn' as const,
      message: outcome.message,
    })),
    { at, level: fallbackCount ? 'warn' : 'ok', message: `${usedCount} module analyses used Thinker; ${fallbackCount} used fallback` },
    { at, level: 'info', message: 'Aggregating module findings into repository-level dashboard metrics, test cases, insights, coverage, and risk heatmap' },
    { at, level: summary.missingRecommended ? 'warn' : 'ok', message: `Detected ${summary.missingRecommended} missing recommended tests` },
    { at, level: summary.suspiciousTests ? 'warn' : 'ok', message: `Detected ${summary.suspiciousTests} suspicious tests` },
    { at, level: modelContextTruncated ? 'warn' : 'ok', message: modelContextTruncated ? 'Model context used full repo inventory and a budgeted code excerpt set; repo scan evidence was not limited.' : 'Model context included all scanned source and test snippets.' },
    { at, level: 'info', message: `Context audit — scanned: ${facts.filesIndexed} files, ${facts.sourceFiles.length} source, ${facts.testFiles.length} tests, ${facts.modules.length} modules` },
    { at, level: 'info', message: `Context audit — user evidence: ${productDocCount} product docs, ${docSourceCount} doc sources, ${qcFileCount} QC files, ${qcRowCount} QC rows` },
    { at, level: modelContextTruncated ? 'warn' : 'ok', message: `Context audit — model evidence: ${facts.sourceSnippets.length} source snippets, ${facts.testSnippets.length} test snippets, ${moduleOutcomes.length} module prompts, 1 aggregate prompt${modelContextTruncated ? ', budgeted excerpts' : ''}` },
    { at, level: aggregateOutcome.status === 'used' ? 'ok' : 'warn', message: aggregateOutcome.message },
    { at, level: 'ok', message: 'Generated initial testing insights and dashboard payload' },
  ];
}

export async function runOnboardingScan(
  repo: RepoRecord,
  draft: OnboardingDraftInput,
  onProgress?: ScanProgress,
): Promise<OnboardingCommitResponse> {
  if (!repo.clonePath) {
    throw new Error('Repository clone not found');
  }

  const facts = await analyzeRepo(repo.clonePath, onProgress);
  const fallback = fallbackReasoning(facts, draft);
  const moduleTargets = buildModuleTargets(facts);

  // The per-module model analysis is the long tail; emit a progress tick as each module completes so
  // the bar reflects real work (60 → 88%) instead of freezing.
  let completed = 0;
  const total = Math.max(1, moduleTargets.length);
  onProgress?.({ message: `Analyzing ${moduleTargets.length} modules with the model…`, percent: 60 });
  const moduleOutcomes = await runWithConcurrency(moduleTargets, MODULE_MODEL_CONCURRENCY, async module => {
    const outcome = await analyzeModuleWithModel(module, facts, draft);
    completed += 1;
    onProgress?.({ message: `Analyzed module ${completed}/${total}: ${module.name}`, percent: 60 + Math.round((completed / total) * 28) });
    if (outcome.reasoning) return outcome;
    return {
      ...outcome,
      reasoning: fallbackModuleReasoning(module, facts, draft),
    };
  });

  onProgress?.({ message: 'Aggregating findings into the dashboard…', percent: 92 });
  const mergedModuleReasoning = mergeReasoningResults(moduleOutcomes.map(outcome => outcome.reasoning ?? fallback));
  const aggregateOutcome = await aggregateWithModel(facts, draft, moduleOutcomes, mergedModuleReasoning);
  const reasoning = normalizeReasoning(aggregateOutcome.reasoning, fallback);
  const { summary, dashboard } = buildDashboard(repo, facts, draft, reasoning);
  const logs = buildLogs(facts, draft, summary, moduleOutcomes, aggregateOutcome);
  onProgress?.({ message: 'Generated initial testing insights', percent: 98, level: 'ok' });

  return {
    jobId: `scan-${repo.id}-${Date.now()}`,
    summary,
    logs,
    dashboard,
  };
}
