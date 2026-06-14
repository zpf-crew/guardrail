import test from 'node:test';
import assert from 'node:assert/strict';
import { UiBrowserAdapter } from './ui-browser.adapter.js';
import { LocalGuardrailRepositoryProvider } from '../../repositories/local-guardrail-repository-provider.js';
import type { AdapterInput } from '../test-type-adapter.js';
import type { GenerationResult, WorkbenchSession, TestPlan, ScenarioRunResult } from '../../workbench.types.js';
import type { DevServerLease } from '../../dev-server/dev-server-orchestrator.js';
import type { DevServerTarget } from '../../dev-server/dev-server-resolver.js';

interface StubDevServerOptions {
  resolve?: (clonePath: string, sessionId?: string) => Promise<DevServerTarget | null>;
  start?: (target: DevServerTarget, signal: AbortSignal, route?: string) => Promise<DevServerLease>;
  stop?: (lease: DevServerLease) => Promise<void>;
}

function stubDevServer(options: StubDevServerOptions = {}) {
  return {
    resolve: options.resolve ?? (async () => ({
      kind: 'subprocess' as const,
      command: 'pnpm',
      args: ['dev'],
      cwd: '/tmp',
      port: 5555,
      healthPath: '/',
    })),
    start: options.start ?? (async (_target, _signal, route = '/') => ({
      baseUrl: 'http://127.0.0.1:5555',
      route,
      stop: async () => {},
    })),
    stop: options.stop ?? (async lease => { await lease.stop(); }),
  };
}

function defaultAgentScenarioResult(overrides: Partial<ScenarioRunResult> = {}): ScenarioRunResult {
  return {
    outcome: 'Passed',
    durationMs: 1000,
    evidence: [],
    thenVerdicts: [],
    reason: null,
    iterationsUsed: 1,
    constraintsApplied: { behavior: 'Test', maxStepDurationMs: 20_000, maxSteps: 15 },
    ...overrides,
  };
}

function createAdapter(options: ConstructorParameters<typeof UiBrowserAdapter>[0] = {}) {
  return new UiBrowserAdapter({
    devServer: stubDevServer(),
    agentRunner: {
      runScenario: async () => defaultAgentScenarioResult(),
    },
    ...options,
  });
}

async function buildInput(overrides: Partial<AdapterInput> = {}): Promise<AdapterInput> {
  const repo = await new LocalGuardrailRepositoryProvider({ rootDir: process.cwd() }).getContext(
    'guardrail',
    'user-1',
    { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] },
  );
  const session: WorkbenchSession = {
    id: 'wb-test',
    repoId: 'guardrail',
    userId: 'user-1',
    repo: repo.repo,
    createdAt: '2026-06-12T00:00:00.000Z',
    steps: { intent: 'done', isolation: 'active', plan: 'locked', generate: 'locked', run: 'locked', review: 'locked' },
    intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] },
    isolation: {
      target: { feature: 'Checkout', repo: repo.repo },
      sourceFiles: [],
      existingTestFiles: [],
      specDocs: [],
      qcCases: [],
      currentCoverage: { line: 0, branch: 0 },
      currentStatus: { failed: 0, suspicious: 0, missing: 1 },
      userJourneys: ['Open CheckoutPage page'],
      classifications: [{
        behavior: 'Complete checkout',
        status: 'Missing',
        suggestedTypes: ['UI / Browser'],
        risk: 'High',
        explanation: 'Test isolation context.',
      }],
    },
  };

  const skills = { load: async (name: string) => ({ name, content: `# ${name}` }) } as AdapterInput['skills'];
  const structuredModel = {
    runStep: async () => {
      throw new Error('structuredModel.runStep must be overridden by this test');
    },
  } as unknown as AdapterInput['structuredModel'];

  return {
    session,
    repository: repo,
    emit: async event => event,
    modelConnect: null,
    skills,
    structuredModel,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function stubGeneration(): GenerationResult {
  return {
    timeline: [{ label: 'Generate onboarding scenario', status: 'done' }],
    changes: [{
      id: 'ui-browser-onboarding',
      action: 'Add',
      testType: 'UI / Browser',
      title: 'Complete onboarding with selected repository',
      file: 'guardrail-tests/ui/onboarding.feature',
      feature: 'Onboarding',
      risk: 'High',
      reason: 'Covers browser-visible onboarding behavior.',
      diff: [{ kind: 'add', text: 'Scenario: Complete onboarding with selected repository' }],
      status: 'staged',
    }],
    beforeAfter: { before: ['No UI Browser evidence.'], after: ['One scenario staged.'] },
  };
}

function stubGenerationWithTwoChanges(): GenerationResult {
  return {
    timeline: [{ label: 'Generate onboarding scenarios', status: 'done' }],
    changes: [
      {
        id: 'ui-browser-onboarding',
        action: 'Add',
        testType: 'UI / Browser',
        title: 'Complete onboarding with selected repository',
        file: 'guardrail-tests/ui/onboarding.feature',
        feature: 'Onboarding',
        risk: 'High',
        reason: 'Covers browser-visible onboarding behavior.',
        diff: [{ kind: 'add', text: 'Scenario: Complete onboarding with selected repository' }],
        status: 'staged',
      },
      {
        id: 'ui-browser-checkout',
        action: 'Add',
        testType: 'UI / Browser',
        title: 'Complete checkout flow',
        file: 'guardrail-tests/ui/checkout.feature',
        feature: 'Checkout',
        risk: 'High',
        reason: 'Covers browser-visible checkout behavior.',
        diff: [{ kind: 'add', text: 'Scenario: Complete checkout flow' }],
        status: 'staged',
      },
    ],
    beforeAfter: { before: ['No UI Browser evidence.'], after: ['Two scenarios staged.'] },
  };
}

function generationStructuredModel() {
  return {
    runStep: async ({ schemaName }: { schemaName: string }) => {
      if (schemaName === 'GenerationChanges') {
        return { changes: structuredClone(stubGeneration()).changes };
      }
      throw new Error(`unexpected schema ${schemaName}`);
    },
  } as never;
}

const plan: TestPlan = {
  proposedActions: [{ action: 'add', label: 'Add UI Browser onboarding test', count: 1 }],
  risk: {
    productionCodeChanges: 'none',
    testDataChanges: false,
    browserAutomationRequired: true,
    mobileSimulatorRequired: 'no',
    externalApiMocking: 'no',
  },
  filesToChange: ['guardrail-tests/ui/onboarding.feature'],
  questions: [],
};

test('ui browser adapter uses structured model outputs for analyze plan generate review', async () => {
  const outputs = {
    IsolationClassifications: {
      classifications: [{
        behavior: 'Complete onboarding with selected repository',
        status: 'Missing',
        suggestedTypes: ['UI / Browser'],
        risk: 'High',
        explanation: 'Model identified no UI Browser evidence in repo context.',
      }],
    },
    TestPlanQuestions: {
      questions: [{
        id: 'coupon-apply-conflict',
        question: 'Spec says coupon auto-applies but QC expects manual apply — which behavior should the test assert?',
        options: ['Auto-apply on cart load', 'Manual apply via button'],
      }],
    },
    GenerationChanges: {
      changes: [{
        id: 'ui-browser-onboarding',
        action: 'Add',
        testType: 'UI / Browser',
        title: 'Complete onboarding with selected repository',
        file: 'guardrail-tests/ui/onboarding.feature',
        feature: 'Onboarding',
        risk: 'High',
        reason: 'Covers browser-visible onboarding behavior.',
        diff: [{ kind: 'add', text: 'Scenario: Complete onboarding with selected repository' }],
        status: 'staged',
      }],
    },
    ReviewRecommendation: {
      recommendation: 'Review screenshot evidence before applying.',
    },
  };
  const seenSchemas: string[] = [];
  const seenContexts: Record<string, unknown> = {};
  const input = await buildInput({
    structuredModel: {
      runStep: async ({ schemaName, context }: { schemaName: keyof typeof outputs; context: unknown }) => {
        seenSchemas.push(schemaName);
        seenContexts[schemaName === 'IsolationClassifications' ? 'analyze' : schemaName === 'TestPlanQuestions' ? 'planQuestions' : schemaName.toLowerCase()] = context;
        return structuredClone(outputs[schemaName]);
      },
    } as never,
  });
  const adapter = createAdapter();

  const isolation = await adapter.analyze(input);
  input.session.isolation = isolation;
  const testPlan = await adapter.plan({ ...input, isolation });
  input.session.plan = testPlan;
  const generation = await adapter.generate({ ...input, plan: testPlan, approval: { decision: 'approve', answers: {} } });
  input.session.approval = { decision: 'approve', answers: {} };
  const run = await adapter.run({ ...input, generation });
  const review = await adapter.review({ ...input, generation, run });

  assert.deepEqual(seenSchemas, [
    'IsolationClassifications',
    'TestPlanQuestions',
    'GenerationChanges',
    'ReviewRecommendation',
  ]);
  assert.ok(JSON.stringify(seenContexts.analyze).includes('onboarding'));
  assert.ok(JSON.stringify(seenContexts.planQuestions ?? '').includes('guardrailUiTestDesign'));
  assert.ok(JSON.stringify(seenContexts.generationchanges ?? '').includes('generationScope'));
  assert.ok(JSON.stringify(seenContexts.reviewrecommendation ?? '').includes('unresolvedPlanQuestions'));
  assert.equal(isolation.target.feature, 'Checkout');
  assert.ok(isolation.classifications.length > 0);
  assert.ok(testPlan.proposedActions.length > 0);
  assert.equal(testPlan.questions.length, 1);
  assert.equal(testPlan.questions[0]?.id, 'coupon-apply-conflict');
  assert.ok(testPlan.filesToChange.some(file => file.includes('checkout') || file.includes('guardrail-tests/ui/')));
  assert.equal(generation.changes[0]?.title, 'Complete onboarding with selected repository');
  assert.equal(run.ui.outcome, 'Passed');
  assert.equal(review.testsAdded, 1);
  assert.equal(review.openQuestions, 1);
  assert.match(review.recommendation, /screenshot/i);
});

test('ui browser adapter uses normalized screenshot evidence returned from emit', async () => {
  const normalizedHref = '/api/workbench/wb-test/artifacts/onboarding.png';
  const emittedLabels: string[] = [];
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async ({ onScreenshot }) => {
        const emitted = await onScreenshot?.({ kind: 'screenshot', label: 'Onboarding screenshot', href: '/tmp/onboarding.png' });
        return defaultAgentScenarioResult({
          evidence: emitted ? [emitted] : [],
        });
      },
    },
  });
  const input = await buildInput({
    structuredModel: generationStructuredModel(),
    emit: async event => {
      if (event.type !== 'screenshot') return event;
      emittedLabels.push(event.artifact.label);
      return { ...event, artifact: { ...event.artifact, href: normalizedHref } };
    },
  });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.evidence[0]?.href, normalizedHref);
  assert.ok(emittedLabels.length > 0);
  assert.ok(emittedLabels.every(label => label === 'Onboarding screenshot'));
  assert.ok(run.ui.evidence.every(item => item.href === normalizedHref));
  assert.equal(run.matrix[0]?.evidence, 'screenshot');
  assert.equal(run.matrix[0]?.evidenceItems?.[0]?.href, normalizedHref);
});

test('ui browser adapter generate returns no-op changes when ui tests are skipped', async () => {
  const adapter = createAdapter();
  const input = await buildInput();

  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'approve', skipUiTests: true, answers: {} },
  });

  assert.deepEqual(generation.changes, []);
  assert.match(generation.beforeAfter.after[0] ?? '', /skipped/i);
});

test('ui browser adapter generate returns no-op changes for unit-tests-only approval', async () => {
  const adapter = createAdapter();
  const input = await buildInput();

  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'approve', unitTestsOnly: true, answers: {} },
  });

  assert.deepEqual(generation.changes, []);
  assert.match(generation.timeline[0]?.label ?? '', /unit/i);
});

test('ui browser adapter generate returns no-op changes when approval is canceled', async () => {
  const adapter = createAdapter();
  const input = await buildInput();

  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'cancel', answers: {} },
  });

  assert.deepEqual(generation.changes, []);
  assert.match(generation.timeline[0]?.label ?? '', /cancel/i);
});

test('ui browser adapter propagates runner abort rejection', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const adapter = createAdapter({
    agentRunner: { runScenario: async () => { throw abortError; } },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  await assert.rejects(adapter.run({ ...input, generation }), abortError);
});

test('ui browser adapter propagates model abort rejection', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const adapter = createAdapter();
  const input = await buildInput({
    structuredModel: {
      runStep: async () => { throw abortError; },
    } as never,
  });

  await assert.rejects(
    adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } }),
    abortError,
  );
});

test('ui browser adapter returns attention for flaky runner results', async () => {
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async () => defaultAgentScenarioResult({ outcome: 'Flaky', durationMs: 1500 }),
    },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.outcome, 'Flaky');
  assert.equal(run.attention?.kind, 'flaky');
});

test('ui browser adapter stores per-test failure reason in matrix rows', async () => {
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async () => defaultAgentScenarioResult({
        outcome: 'Failed',
        durationMs: 2100,
        evidence: [{ kind: 'screenshot', label: 'Homepage loaded', href: '/tmp/home.png' }],
        reason: 'agent-browser find role button click --name Add to cart failed: element not found',
      }),
    },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.matrix[0]?.status, 'Failed');
  assert.match(run.matrix[0]?.reason ?? '', /Add to cart failed/);
  assert.match(run.attention?.reason ?? '', /Add to cart failed/);
});

test('ui browser adapter returns failed result for non-abort runner failure', async () => {
  const adapter = createAdapter({
    agentRunner: { runScenario: async () => { throw new Error('browser unavailable'); } },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.outcome, 'Failed');
  assert.equal(run.attention?.kind, 'failed');
  assert.match(run.attention?.reason ?? '', /browser unavailable/);
});

test('ui browser adapter does not call agent runner after no-op generation', async () => {
  let runnerCalled = false;
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async () => {
        runnerCalled = true;
        return defaultAgentScenarioResult();
      },
    },
  });
  const input = await buildInput({
    structuredModel: {
      runStep: async () => {
        throw new Error('structuredModel.runStep should not run for skipped UI tests');
      },
    } as never,
  });
  const generation = await adapter.generate({
    ...input,
    plan,
    approval: { decision: 'approve', skipUiTests: true, answers: {} },
  });

  const run = await adapter.run({ ...input, generation });
  input.session.plan = plan;
  const review = await adapter.review({
    ...input,
    generation,
    run,
    structuredModel: {
      runStep: async () => ({ recommendation: 'No UI Browser changes were generated.' }),
    } as never,
  });

  assert.equal(runnerCalled, false);
  assert.equal(run.ui.outcome, 'Skipped');
  assert.equal(run.matrix[0]?.status, 'Skipped');
  assert.equal(review.testsAdded, 0);
  assert.equal(review.testsPassing, '0/1');
});

test('run starts and stops dev server before agent-browser', async () => {
  const events: string[] = [];
  const adapter = createAdapter({
    devServer: {
      start: async () => ({
        baseUrl: 'http://127.0.0.1:5555',
        route: '/',
        stop: async () => { events.push('stopped'); },
      }),
      resolve: async () => ({
        kind: 'subprocess',
        command: 'pnpm',
        args: ['dev'],
        cwd: '/tmp',
        port: 5555,
        healthPath: '/',
      }),
      stop: async lease => { await lease.stop(); },
    },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });

  await adapter.run({ ...input, generation });

  assert.deepEqual(events, ['stopped']);
});

test('run executes one agent-browser session per generated UI change', async () => {
  const runCalls: string[] = [];
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async ({ baseUrl }) => {
        runCalls.push(baseUrl);
        return defaultAgentScenarioResult({ durationMs: 100 });
      },
    },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  const generation = stubGenerationWithTwoChanges();

  const run = await adapter.run({ ...input, generation });

  assert.equal(runCalls.length, 2);
  assert.equal(run.matrix.length, 2);
  assert.equal(run.matrix[0]?.status, 'Passed');
  assert.equal(run.matrix[1]?.status, 'Passed');
  assert.equal(run.ui.outcome, 'Passed');
  assert.equal(run.ui.durationMs, 200);
});

test('ui browser adapter uses agent runner with plan run constraints', async () => {
  let seenMaxStepDurationMs: number | null = null;
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async ({ constraints }) => {
        seenMaxStepDurationMs = constraints.maxStepDurationMs;
        return defaultAgentScenarioResult({
          thenVerdicts: [{ stepIndex: 2, text: 'Then products page is displayed', satisfied: true, reason: 'ok' }],
          iterationsUsed: 4,
          constraintsApplied: constraints,
        });
      },
    },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  input.session.plan = {
    ...plan,
    runConstraints: [{ behavior: 'Complete onboarding with selected repository', maxStepDurationMs: 20_000, maxSteps: 15 }],
  };
  const generation = await adapter.generate({ ...input, plan: input.session.plan, approval: { decision: 'approve', answers: {} } });

  const run = await adapter.run({ ...input, generation });

  assert.equal(run.ui.outcome, 'Passed');
  assert.equal(run.matrix[0]?.status, 'Passed');
  assert.equal(run.matrix[0]?.reason, null);
  assert.equal(seenMaxStepDurationMs, 20_000);
});

test('ui browser adapter lets plan model override per-step run constraints', async () => {
  let seenMaxStepDurationMs: number | null = null;
  const outputs = {
    TestPlanQuestions: {
      questions: [],
      runConstraintOverrides: [{
        behavior: 'Complete onboarding with selected repository',
        maxStepDurationMs: 45_000,
        maxSteps: 22,
        reason: 'Repository scan progress may take longer than a normal UI step',
      }],
    },
  };
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async ({ constraints }) => {
        seenMaxStepDurationMs = constraints.maxStepDurationMs;
        return defaultAgentScenarioResult({ constraintsApplied: constraints });
      },
    },
  });
  const input = await buildInput({
    structuredModel: {
      runStep: async ({ schemaName }: { schemaName: keyof typeof outputs }) => {
        if (schemaName === 'TestPlanQuestions') return structuredClone(outputs.TestPlanQuestions);
        if (schemaName === 'GenerationChanges') {
          return { changes: structuredClone(stubGeneration()).changes };
        }
        throw new Error(`unexpected schema ${schemaName}`);
      },
    } as never,
  });

  const testPlan = await adapter.plan({ ...input, isolation: input.session.isolation! });
  input.session.plan = testPlan;
  const generation = await adapter.generate({ ...input, plan: testPlan, approval: { decision: 'approve', answers: {} } });
  const run = await adapter.run({ ...input, generation });

  const onboardingConstraint = testPlan.runConstraints?.find(
    item => item.behavior === 'Complete onboarding with selected repository',
  );
  assert.equal(onboardingConstraint?.maxStepDurationMs, 45_000);
  assert.equal(seenMaxStepDurationMs, 45_000);
  assert.equal(run.ui.outcome, 'Passed');
});

test('ui browser adapter keeps injected agent runner path independent of core guide loading', async () => {
  const adapter = createAdapter({
    agentRunner: {
      runScenario: async () => defaultAgentScenarioResult({
        thenVerdicts: [{ stepIndex: 2, text: 'Then products page is displayed', satisfied: true, reason: 'ok' }],
        iterationsUsed: 4,
      }),
    },
  });
  const input = await buildInput({ structuredModel: generationStructuredModel() });
  input.session.plan = plan;
  const generation = await adapter.generate({ ...input, plan, approval: { decision: 'approve', answers: {} } });
  const run = await adapter.run({ ...input, generation });
  assert.equal(run.ui.outcome, 'Passed');
});
