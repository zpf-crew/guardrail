import type { AdapterInput, TestTypeAdapter } from '../test-type-adapter.js';
import type {
  GenerationResult,
  IsolationResult,
  PlanApproval,
  ReviewSummary,
  TestPlan,
  TestRunResult,
} from '../../workbench.types.js';
import { UiBrowserRunner, type UiBrowserRunnerResult, type UiBrowserRunnerRunArgs } from './ui-browser-runner.js';

interface UiBrowserRunnerLike {
  run(args: UiBrowserRunnerRunArgs): Promise<UiBrowserRunnerResult>;
}

interface UiBrowserAdapterOptions {
  runner?: UiBrowserRunnerLike;
}

function uiCommandFor(input: AdapterInput): string {
  return `agent-browser open ${input.repository.frontend.url}`;
}

function durationLabel(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
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
        title: '',
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

  readonly #runner: UiBrowserRunnerLike;

  constructor(options: UiBrowserAdapterOptions = {}) {
    this.#runner = options.runner ?? new UiBrowserRunner();
  }

  async analyze(input: AdapterInput): Promise<IsolationResult> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-isolation-files');
    await input.emit({ type: 'progress', message: 'Scanning repository context for UI Browser gaps.', percent: 20 });
    return input.structuredModel.runStep({
      profile: 'thinker',
      skill,
      schemaName: 'IsolationResult',
      context: { intent: input.session.intent, repository: input.repository },
      signal: input.signal,
    });
  }

  async plan(input: AdapterInput & { isolation: IsolationResult }): Promise<TestPlan> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-plan');
    await input.emit({ type: 'progress', message: 'Preparing UI Browser test plan.', percent: 35 });
    return input.structuredModel.runStep({
      profile: 'thinker',
      skill,
      schemaName: 'TestPlan',
      context: { intent: input.session.intent, isolation: input.isolation, repository: input.repository },
      signal: input.signal,
    });
  }

  async generate(input: AdapterInput & { plan: TestPlan; approval: PlanApproval }): Promise<GenerationResult> {
    input.signal.throwIfAborted();

    if (input.approval.decision === 'cancel') {
      return noOpGeneration('Plan approval canceled', 'No changes generated because approval was canceled.');
    }
    if (input.approval.skipUiTests) {
      return noOpGeneration('UI Browser tests skipped by approval', 'No changes generated because UI Browser tests were skipped.');
    }
    if (input.approval.unitTestsOnly) {
      return noOpGeneration('Unit-tests-only approval selected', 'No UI Browser changes generated because approval requested unit tests only.');
    }

    const skill = await input.skills.load('test-generate-ui-browser');
    await input.emit({ type: 'progress', message: 'Generating UI Browser test scenarios.', percent: 55 });
    return input.structuredModel.runStep({
      profile: 'coder',
      skill,
      schemaName: 'GenerationResult',
      context: {
        intent: input.session.intent,
        plan: input.plan,
        repository: input.repository,
        approval: input.approval,
      },
      signal: input.signal,
    });
  }

  async run(input: AdapterInput & { generation: GenerationResult }): Promise<TestRunResult> {
    input.signal.throwIfAborted();
    await input.emit({ type: 'progress', message: 'Running UI Browser tests.', percent: 75 });

    if (input.generation.changes.length === 0) {
      return noOpRun();
    }

    const runnerResult = await this.#runUi(input);
    const command = uiCommandFor(input);
    const evidence = runnerResult.evidence;
    const primaryChange = input.generation.changes[0];

    return {
      unit: { command: 'not run', outcome: 'Skipped', passed: 0, durationMs: 0, suite: 'Unit' },
      ui: {
        command,
        browser: 'Chromium',
        outcome: runnerResult.outcome,
        passed: runnerResult.outcome === 'Passed' ? input.generation.changes.length : 0,
        durationMs: runnerResult.durationMs,
        evidence,
      },
      mobile: { command: 'not run', devices: [], outcome: 'Skipped', passed: 0, durationMs: 0, evidence: [] },
      coverage: [
        { metric: 'Line coverage', before: 0, after: 0 },
        { metric: 'Branch coverage', before: 0, after: 0 },
      ],
      matrix: input.generation.changes.map(change => ({
        title: change.title,
        type: 'UI / Browser',
        status: runnerResult.outcome,
        duration: durationLabel(runnerResult.durationMs),
        evidence: evidence.length > 0 ? evidence.map(item => item.kind).join(', ') : null,
        file: change.file,
      })),
      attention: this.#attentionFor(runnerResult, primaryChange?.title ?? 'UI Browser test'),
    };
  }

  async review(input: AdapterInput & { generation: GenerationResult; run: TestRunResult }): Promise<ReviewSummary> {
    input.signal.throwIfAborted();
    const skill = await input.skills.load('test-review');
    await input.emit({ type: 'progress', message: 'Summarizing UI Browser adapter results.', percent: 95 });
    return input.structuredModel.runStep({
      profile: 'thinker',
      skill,
      schemaName: 'ReviewSummary',
      context: {
        intent: input.session.intent,
        generation: input.generation,
        run: input.run,
        repository: input.repository,
      },
      signal: input.signal,
    });
  }

  async #runUi(input: AdapterInput & { generation: GenerationResult }): Promise<UiBrowserRunnerResult> {
    let commandProgress = Promise.resolve();
    try {
      await input.emit({ type: 'progress', message: 'Opening frontend in agent-browser.', percent: 78 });
      const result = await this.#runner.run({
        url: input.repository.frontend.url,
        signal: input.signal,
        onCommand: (args, index, total) => {
          commandProgress = commandProgress.then(() => input.emit({
            type: 'progress',
            message: `Running agent-browser ${args[0]} (${index + 1}/${total}).`,
            percent: Math.min(90, 78 + Math.round(((index + 1) / total) * 10)),
          })).then(() => undefined);
        },
      });
      await commandProgress;
      const evidence: UiBrowserRunnerResult['evidence'] = [];
      for (const item of result.evidence) {
        if (item.kind === 'screenshot') {
          const emitted = await input.emit({ type: 'screenshot', artifact: item });
          if (emitted.type === 'screenshot') evidence.push(emitted.artifact);
        } else {
          evidence.push(item);
        }
      }
      return { ...result, evidence };
    } catch (error) {
      await commandProgress;
      rethrowIfAbort(error, input.signal);
      await input.emit({
        type: 'progress',
        message: `Warning: UI Browser runner failed. ${error instanceof Error ? error.message : String(error)}`,
        percent: 80,
      });
      return {
        outcome: 'Failed',
        durationMs: 0,
        evidence: [],
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  #attentionFor(result: UiBrowserRunnerResult, testTitle: string): TestRunResult['attention'] {
    if (result.outcome !== 'Failed' && result.outcome !== 'Flaky') {
      return undefined;
    }

    return {
      testTitle,
      kind: result.outcome === 'Flaky' ? 'flaky' : 'failed',
      reason: result.errorMessage ?? `UI Browser runner reported ${result.outcome.toLowerCase()} outcome.`,
      likelyCause: result.outcome === 'Flaky'
        ? 'The UI or browser automation has inconsistent timing or state.'
        : 'The local frontend page was unavailable or did not reach the expected state.',
      suggestedFix: result.outcome === 'Flaky'
        ? 'Review the captured trace and stabilize wait conditions before applying.'
        : 'Start the frontend and rerun the UI Browser scenario.',
      actions: ['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'],
    };
  }
}
