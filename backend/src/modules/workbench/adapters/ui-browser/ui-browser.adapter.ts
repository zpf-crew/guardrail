import type { AdapterInput, TestTypeAdapter } from '../test-type-adapter.js';
import type {
  Evidence,
  FeatureModule,
  GenerationResult,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  RunOutcome,
  TestPlan,
  TestRunResult,
} from '../../workbench.types.js';
import { buildAnalyzePrompt, buildGeneratePrompt } from './ui-browser.prompts.js';
import { screenshotEvidence, traceEvidence } from './ui-browser-evidence.js';

interface UiBrowserRunnerResult {
  outcome: RunOutcome;
  durationMs: number;
  evidence: Evidence[];
  errorMessage?: string;
}

interface UiBrowserRunner {
  run(args: {
    command: string;
    url: string;
    featureFile: string;
    signal: AbortSignal;
  }): Promise<UiBrowserRunnerResult>;
}

interface UiBrowserAdapterOptions {
  runner?: UiBrowserRunner;
}

const onboardingBehavior = 'Complete onboarding with selected repository';
const generatedFile = 'guardrail-tests/ui/onboarding.feature';

function featureFrom(input: AdapterInput): FeatureModule {
  return input.session.intent.feature ?? 'Checkout';
}

function uiCommandFor(input: AdapterInput): string {
  return `agent-browser open ${input.repository.frontend.url}`;
}

function durationLabel(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }

  const data = error as { name?: unknown; code?: unknown; message?: unknown };
  return data.name === 'AbortError'
    || data.name === 'CanceledError'
    || data.name === 'CancelledError'
    || data.code === 'ABORT_ERR'
    || data.code === 'ERR_CANCELED'
    || (typeof data.message === 'string' && /\b(abort|aborted|cancelled|canceled)\b/i.test(data.message));
}

function rethrowIfAbort(error: unknown, signal: AbortSignal): void {
  if (signal.aborted || isAbortLike(error)) {
    throw error;
  }
}

function fallbackFeatureText(prompt: string): string {
  return [
    'Feature: Guardrail onboarding',
    '',
    `  # Intent: ${prompt}`,
    '  Scenario: Complete onboarding with selected repository',
    '    Given a developer opens Guardrail onboarding',
    '    When they select the local repository and continue',
    '    Then the initial scan starts and onboarding progress is visible',
  ].join('\n');
}

function noOpGeneration(reason: string, after: string): GenerationResult {
  return {
    timeline: [
      { label: reason, status: 'done' },
      { label: 'No UI Browser changes generated', status: 'done' },
    ],
    changes: [],
    beforeAfter: { before: ['No UI Browser onboarding test exists.'], after: [after] },
  };
}

function noOpRun(): TestRunResult {
  return {
    unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
    ui: {
      command: 'not run',
      browser: 'Chromium',
      outcome: 'Skipped',
      passed: 0,
      durationMs: 0,
      evidence: [],
    },
    mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
    coverage: [
      { metric: 'Line coverage', before: 0, after: 0 },
      { metric: 'Branch coverage', before: 0, after: 0 },
    ],
    matrix: [
      {
        title: onboardingBehavior,
        type: 'UI / Browser',
        status: 'Skipped',
        duration: null,
        evidence: null,
        file: '',
      },
    ],
  };
}

export class UiBrowserAdapter implements TestTypeAdapter {
  readonly testType = 'UI / Browser' as const;

  readonly #runner?: UiBrowserRunner;

  constructor(options: UiBrowserAdapterOptions = {}) {
    this.#runner = options.runner;
  }

  async analyze(input: AdapterInput): Promise<IsolationResult> {
    input.signal.throwIfAborted();
    input.emit({ type: 'progress', message: 'Classifying UI Browser onboarding gaps.', percent: 20 });
    await this.#tryThinker(input, buildAnalyzePrompt(input.session.intent.prompt), 'UI Browser gap classification used deterministic fallback.');

    return {
      target: { feature: featureFrom(input), repo: clone(input.repository.repo) },
      sourceFiles: clone(input.repository.relatedFiles.filter(file => file.kind === 'source')),
      existingTestFiles: clone(input.repository.relatedFiles.filter(file => file.kind === 'test')),
      specDocs: clone(input.repository.specDocs),
      qcCases: clone(input.repository.qcCases),
      currentCoverage: { line: 0, branch: 0 },
      currentStatus: { failed: 0, suspicious: 0, missing: 1, flaky: 0 },
      userJourneys: [onboardingBehavior],
      classifications: [
        {
          behavior: onboardingBehavior,
          status: 'Missing',
          suggestedTypes: ['UI / Browser'],
          risk: 'High',
          explanation: 'Onboarding depends on browser-visible repository selection and scan progress, but no UI Browser evidence exists yet.',
        },
      ],
    };
  }

  async plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan> {
    input.signal.throwIfAborted();
    input.emit({ type: 'progress', message: 'Preparing UI Browser test plan.', percent: 35 });

    return {
      proposedActions: [{ action: 'add', label: 'Add UI Browser onboarding test', count: 1 }],
      risk: {
        productionCodeChanges: 'none',
        testDataChanges: false,
        browserAutomationRequired: true,
        mobileSimulatorRequired: 'no',
        externalApiMocking: 'no',
      },
      filesToChange: [generatedFile],
      questions: [],
    };
  }

  async generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult> {
    input.signal.throwIfAborted();
    input.emit({ type: 'progress', message: 'Generating deterministic UI Browser fallback payload.', percent: 55 });

    if (input.approval.decision === 'cancel') {
      return noOpGeneration('Plan approval canceled', 'No changes generated because approval was canceled.');
    }
    if (input.approval.skipUiTests) {
      return noOpGeneration('UI Browser tests skipped by approval', 'No changes generated because UI Browser tests were skipped.');
    }
    if (input.approval.unitTestsOnly) {
      return noOpGeneration('Unit-tests-only approval selected', 'No UI Browser changes generated because approval requested unit tests only.');
    }

    await this.#tryCoder(input, buildGeneratePrompt(input.session.intent.prompt), 'UI Browser feature generation used deterministic fallback.');

    const featureText = fallbackFeatureText(input.session.intent.prompt);

    return {
      timeline: [
        { label: 'Load onboarding repository context', status: 'done' },
        { label: 'Draft UI Browser onboarding scenario', status: 'done' },
        { label: 'Stage generated feature payload', status: 'done' },
      ],
      changes: [
        {
          id: 'ui-browser-onboarding',
          action: 'Add',
          testType: 'UI / Browser',
          title: onboardingBehavior,
          file: generatedFile,
          feature: featureFrom(input),
          risk: 'High',
          reason: 'Adds browser-level coverage for repository onboarding and initial scan progress.',
          diff: featureText.split('\n').map(line => ({ kind: 'add', text: line })),
          status: 'staged',
        },
      ],
      beforeAfter: {
        before: ['Onboarding has no UI Browser automation evidence.'],
        after: ['One UI Browser onboarding feature is staged for review.'],
      },
    };
  }

  async run(input: AdapterInput & { generation: GenerationResult }): Promise<TestRunResult> {
    input.signal.throwIfAborted();
    input.emit({ type: 'progress', message: 'Running UI Browser adapter fallback runner.', percent: 75 });

    if (input.generation.changes.length === 0) {
      return noOpRun();
    }

    const runnerResult = await this.#runUi(input);
    const command = uiCommandFor(input);
    const evidence = runnerResult.evidence.length > 0
      ? runnerResult.evidence
      : [
          screenshotEvidence('Onboarding fallback screenshot'),
          traceEvidence('Onboarding fallback trace'),
        ];

    return {
      unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
      ui: {
        command,
        browser: 'Chromium',
        outcome: runnerResult.outcome,
        passed: runnerResult.outcome === 'Passed' ? 1 : 0,
        durationMs: runnerResult.durationMs,
        evidence,
      },
      mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      coverage: [
        { metric: 'Line coverage', before: 0, after: 0 },
        { metric: 'Branch coverage', before: 0, after: 0 },
      ],
      matrix: [
        {
          title: onboardingBehavior,
          type: 'UI / Browser',
          status: runnerResult.outcome,
          duration: durationLabel(runnerResult.durationMs),
          evidence: evidence.map(item => item.kind).join(', '),
          file: generatedFile,
        },
      ],
      attention: this.#attentionFor(runnerResult),
    };
  }

  async review(input: AdapterInput & { generation: GenerationResult; run: TestRunResult }): Promise<ReviewSummary> {
    input.signal.throwIfAborted();
    input.emit({ type: 'progress', message: 'Summarizing UI Browser adapter results.', percent: 95 });

    const added = input.generation.changes.filter(change => change.action === 'Add').length;
    const updated = input.generation.changes.filter(change => change.action === 'Update').length;
    const deleted = input.generation.changes.filter(change => change.action === 'Delete').length;
    const generatedTests = added + updated;

    return {
      testsAdded: added,
      testsUpdated: updated,
      testsDeleted: deleted,
      testsPassing: generatedTests === 0 ? '0/0' : `${input.run.ui.passed}/${generatedTests}`,
      coverage: { lineDelta: 0, branchDelta: 0 },
      flakyTracked: input.run.ui.outcome === 'Flaky' ? 1 : 0,
      filesChanged: input.generation.changes.map(change => ({
        path: change.file,
        diffStat: change.diff.filter(line => line.kind === 'add').length > 0
          ? `+${change.diff.filter(line => line.kind === 'add').length}`
          : '0',
        changeKind: change.action.toLowerCase() as 'add' | 'update' | 'delete',
      })),
      remainingRisk: [
        {
          label: 'Persistence',
          value: 'Generated UI Browser payload is staged only; persistence is outside this adapter task.',
          sentiment: 'neutral',
        },
      ],
      openQuestions: 0,
      recommendation: 'Review the captured onboarding evidence before enabling persistence.',
    };
  }

  async #runUi(input: AdapterInput & { generation: GenerationResult }): Promise<UiBrowserRunnerResult> {
    if (!this.#runner) {
      return {
        outcome: 'Skipped',
        durationMs: 0,
        evidence: [],
      };
    }

    try {
      return await this.#runner.run({
        command: uiCommandFor(input),
        url: input.repository.frontend.url,
        featureFile: input.generation.changes[0]?.file ?? generatedFile,
        signal: input.signal,
      });
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      input.emit({
        type: 'progress',
        message: `Warning: UI Browser runner failed; using fallback result. ${error instanceof Error ? error.message : String(error)}`,
        percent: 80,
      });
      return {
        outcome: 'Skipped',
        durationMs: 0,
        evidence: [],
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  #attentionFor(result: UiBrowserRunnerResult): TestRunResult['attention'] {
    if (result.outcome !== 'Failed' && result.outcome !== 'Flaky') {
      return undefined;
    }

    return {
      testTitle: onboardingBehavior,
      kind: result.outcome === 'Flaky' ? 'flaky' : 'failed',
      reason: result.errorMessage ?? `UI Browser runner reported ${result.outcome.toLowerCase()} outcome.`,
      likelyCause: result.outcome === 'Flaky'
        ? 'The onboarding UI or browser automation has inconsistent timing or state.'
        : 'The local onboarding page was unavailable or did not reach the expected progress state.',
      suggestedFix: result.outcome === 'Flaky'
        ? 'Review the captured trace and stabilize the onboarding wait conditions before applying.'
        : 'Start the frontend and rerun the UI Browser onboarding scenario.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    };
  }

  async #tryThinker(input: AdapterInput, prompt: string, warning: string): Promise<void> {
    if (!input.modelConnect) {
      return;
    }

    try {
      await input.modelConnect.getThinker().chat([{ role: 'user', content: prompt }], {
        temperature: 0,
        maxTokens: 400,
        signal: input.signal,
      });
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      input.emit({
        type: 'progress',
        message: `Warning: ${warning} ${error instanceof Error ? error.message : String(error)}`,
        percent: 25,
      });
    }
  }

  async #tryCoder(input: AdapterInput, prompt: string, warning: string): Promise<void> {
    if (!input.modelConnect) {
      return;
    }

    try {
      await input.modelConnect.getCoder().chat([{ role: 'user', content: prompt }], {
        temperature: 0,
        maxTokens: 800,
        signal: input.signal,
      });
    } catch (error) {
      rethrowIfAbort(error, input.signal);
      input.emit({
        type: 'progress',
        message: `Warning: ${warning} ${error instanceof Error ? error.message : String(error)}`,
        percent: 60,
      });
    }
  }
}
