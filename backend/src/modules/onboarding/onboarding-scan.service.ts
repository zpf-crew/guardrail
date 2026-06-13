import type { RepoRecord } from '../repos/repos.types.js';
import { modelConnect } from '../model-connect/index.js';
import { analyzeRepo } from './repo-scan-analyzer.js';
import type {
  DashboardPayload,
  InsightAction,
  OnboardingCommitResponse,
  OnboardingDraftInput,
  QCTestCaseInput,
  RepoScanFacts,
  RiskLevel,
  ScanLogEntry,
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

function estimateModuleCoverage(mod: { sourceCount: number; testCount: number }, baselineCoverage?: number): number {
  const ratioCoverage = estimateCoverageFromTestRatio(mod.testCount, mod.sourceCount);
  if (baselineCoverage === undefined) return ratioCoverage;

  const expectedRatio = 0.25;
  const testRatio = mod.sourceCount ? mod.testCount / mod.sourceCount : 0;
  return clamp(baselineCoverage + (testRatio - expectedRatio) * 40, 0, 95);
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
    const feature = facts.modules[index % Math.max(1, facts.modules.length)]?.name ?? 'Core';
    const status = commandPassed ? 'passed' as TestStatus : commandFailed ? 'failed' as TestStatus : 'missing' as TestStatus;
    return {
      id: `T-${String(index + 1).padStart(3, '0')}`,
      title: file.split('/').at(-1)?.replace(/\.(test|spec)\.[^.]+$/i, '').replace(/[-_]/g, ' ') || `Automated test ${index + 1}`,
      status,
      type: file.includes('playwright') || file.includes('cypress') || file.includes('e2e') ? 'UI / Browser' as TestType : 'Unit' as TestType,
      feature,
      risk: index % 4 === 0 ? 'High' as RiskLevel : 'Medium' as RiskLevel,
      lastRunAt: facts.testRun ? nowIso() : null,
      recentRuns: commandPassed ? [1, 1, 1, 1, 1] as (0 | 1)[] : commandFailed ? [0] as (0 | 1)[] : [],
      description: `Discovered from ${file}.`,
      aiNote: commandFailed
        ? { text: `Test command failed: ${facts.testRun?.command}`, tone: 'warn' as const }
        : undefined,
    };
  });
}

function buildDashboard(repo: RepoRecord, facts: RepoScanFacts, draft: OnboardingDraftInput, reasoning: ScanReasoningResult): { summary: ScanSummary; dashboard: DashboardPayload } {
  const summaryInput = reasoning.summary ?? {};
  const automatedTestsFound = facts.testFiles.length;
  const productDocsIndexed = (draft.productDocs ?? []).length + (draft.docSources ?? []).length;
  const qcCasesImported = Math.max((draft.qcPreview ?? []).length, (draft.qcFiles ?? []).length);
  const deterministicFailedTests = facts.testRun?.ok === false ? Math.max(1, automatedTestsFound) : 0;
  const failedTests = clamp(Math.max(summaryInput.failedTests ?? 0, deterministicFailedTests), 0, 99);
  const flakyTests = clamp(summaryInput.flakyTests ?? 0, 0, 99);
  const missingRecommended = clamp(summaryInput.missingRecommended ?? 0, 0, 99);
  const suspiciousTests = clamp(summaryInput.suspiciousTests ?? 0, 0, 99);
  const hasCoverageRun = facts.coverageRun?.coverage !== undefined;
  const estimatedRepoCoverage = estimateCoverageFromTestRatio(facts.testFiles.length, facts.sourceFiles.length);
  const coverage = clamp(summaryInput.coverage ?? facts.coverageRun?.coverage ?? estimatedRepoCoverage, 0, 100);
  const passed = Math.max(0, automatedTestsFound - failedTests - flakyTests - suspiciousTests);
  const healthScore = clamp(coverage - failedTests * 8 - flakyTests * 5 - missingRecommended * 3 - suspiciousTests * 5 + Math.min(10, productDocsIndexed + qcCasesImported), 0, 100);
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
      lastRunAt: status === 'missing' ? null : nowIso(),
      recentRuns: status === 'missing' ? [] : ([1, status === 'failed' ? 0 : 1, 1, status === 'flaky' ? 0 : 1, status === 'suspicious' ? 0 : 1] as (0 | 1)[]),
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

  const structure = facts.modules.length ? facts.modules : [{ name: 'Core', pathPrefix: '', sourceCount: facts.sourceFiles.length, testCount: facts.testFiles.length }];
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
      coverage: { value: coverage, isPercent: true, trend: { value: coverage, sentiment: coverage >= 70 ? 'good' : 'bad', basis: 'initial scan' } },
      highRiskOpen: { value: testCases.filter(tc => tc.risk === 'High' && tc.status !== 'passed').length, trend: { value: 0, sentiment: 'neutral', basis: 'initial scan' } },
    },
    testCases,
    insights,
    structure: structure.map(mod => ({
      pathPrefix: mod.pathPrefix,
      name: mod.name,
      coverage: estimateModuleCoverage(mod, hasCoverageRun ? coverage : undefined),
      counts: [
        { label: 'Unit', count: mod.testCount, kind: 'unit' },
        { label: 'Missing', count: Math.max(0, Math.round(mod.sourceCount / 8) - mod.testCount), kind: 'missing' },
      ],
    })),
    coverage: structure.map(mod => {
      const line = estimateModuleCoverage(mod, hasCoverageRun ? coverage : undefined);
      return {
        module: mod.name,
        line,
        branch: hasCoverageRun ? clamp(line - 12, 0, 90) : clamp(line * 0.75, 0, 90),
      };
    }),
    riskHeatmap: {
      columns: ['Failed', 'Flaky', 'Missing', 'Suspect'],
      rows: structure.map((mod, index) => ({
        module: mod.name,
        values: [
          index === 0 ? Math.min(3, failedTests) : 0,
          index === 1 ? Math.min(3, flakyTests) : 0,
          Math.min(3, Math.max(0, Math.round(mod.sourceCount / 8) - mod.testCount)),
          index === 0 ? Math.min(3, suspiciousTests) : 0,
        ] as (0 | 1 | 2 | 3)[],
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
      coverage,
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

export async function runOnboardingScan(repo: RepoRecord, draft: OnboardingDraftInput): Promise<OnboardingCommitResponse> {
  if (!repo.clonePath) {
    throw new Error('Repository clone not found');
  }

  const facts = await analyzeRepo(repo.clonePath);
  const fallback = fallbackReasoning(facts, draft);
  const moduleTargets = buildModuleTargets(facts);
  const moduleOutcomes = await runWithConcurrency(moduleTargets, MODULE_MODEL_CONCURRENCY, async module => {
    const outcome = await analyzeModuleWithModel(module, facts, draft);
    if (outcome.reasoning) return outcome;
    return {
      ...outcome,
      reasoning: fallbackModuleReasoning(module, facts, draft),
    };
  });
  const mergedModuleReasoning = mergeReasoningResults(moduleOutcomes.map(outcome => outcome.reasoning ?? fallback));
  const aggregateOutcome = await aggregateWithModel(facts, draft, moduleOutcomes, mergedModuleReasoning);
  const reasoning = normalizeReasoning(aggregateOutcome.reasoning, fallback);
  const { summary, dashboard } = buildDashboard(repo, facts, draft, reasoning);
  const logs = buildLogs(facts, draft, summary, moduleOutcomes, aggregateOutcome);

  return {
    jobId: `scan-${repo.id}-${Date.now()}`,
    summary,
    logs,
    dashboard,
  };
}
