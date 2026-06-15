import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UnitAdapter } from './unit.adapter.js';
import type { AdapterInput } from '../test-type-adapter.js';
import type { RepositoryContext } from '../../repositories/repository-context-provider.js';
import type { TestPlan, WorkbenchSession } from '../../workbench.types.js';

async function createRepo(packageJson: object): Promise<string> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'guardrail-unit-adapter-'));
  await mkdir(repoRoot, { recursive: true });
  await writeFile(join(repoRoot, 'package.json'), JSON.stringify(packageJson), 'utf8');
  return repoRoot;
}

function buildSession(repoRoot: string): WorkbenchSession {
  return {
    id: 'unit-session',
    repoId: 'repo-1',
    userId: 'user-1',
    repo: { name: 'shop', path: repoRoot, branch: 'main' },
    createdAt: '2026-06-14T00:00:00.000Z',
    steps: { intent: 'done', isolation: 'done', plan: 'done', generate: 'active', run: 'locked', review: 'locked' },
    intent: { prompt: 'Improve cart unit tests', feature: 'Cart', testTypes: ['Unit'], sources: ['Codebase'] },
    isolation: {
      target: { feature: 'Cart', repo: { name: 'shop', path: repoRoot, branch: 'main' } },
      sourceFiles: [{ path: 'src/cart.ts', kind: 'source' }],
      existingTestFiles: [],
      specDocs: [],
      qcCases: [],
      currentCoverage: { line: 0, branch: 0 },
      currentStatus: { failed: 0, suspicious: 0, missing: 1 },
      userJourneys: [],
      classifications: [{
        behavior: 'Cart totals include item quantity',
        status: 'Missing',
        suggestedTypes: ['Unit'],
        risk: 'High',
        explanation: 'No unit test covers quantity totals.',
      }],
    },
  };
}

function buildPlan(): TestPlan {
  return {
    proposedActions: [{ action: 'add', label: 'Add missing unit tests', count: 1 }],
    risk: {
      productionCodeChanges: 'none',
      testDataChanges: false,
      browserAutomationRequired: false,
      mobileSimulatorRequired: 'no',
      externalApiMocking: 'no',
    },
    filesToChange: ['src/cart.test.ts'],
    questions: [],
  };
}

function buildRepository(repoRoot: string): RepositoryContext {
  return {
    repo: { name: 'shop', path: repoRoot, branch: 'main' },
    relatedFiles: [{ path: 'src/cart.ts', kind: 'source' }],
    specDocs: [],
    qcCases: [],
    sourceSnippets: [{
      path: 'src/cart.test.ts',
      startLine: 1,
      endLine: 4,
      summary: 'Existing Vitest test style',
      text: "import { describe, expect, it } from 'vitest';\n\ndescribe('cart', () => {\n  it('works', () => expect(true).toBe(true));\n});",
    }],
    onboarding: { lastScanAt: null, health: null, coverage: null, testCases: [], insights: [] },
  };
}

test('unit generation rejects empty model output instead of staging a passing placeholder', async () => {
  const repoRoot = await createRepo({
    scripts: { test: 'vitest run' },
    devDependencies: { vitest: '^2.0.0' },
  });
  const session = buildSession(repoRoot);
  const repository = buildRepository(repoRoot);
  const input: AdapterInput = {
    session,
    repository,
    emit: async event => event,
    modelConnect: null,
    skills: { load: async name => ({ name, content: `# ${name}` }) } as AdapterInput['skills'],
    structuredModel: {
      runStep: async ({ schemaName }: { schemaName: string }) => {
        if (schemaName === 'GenerationChanges') return { changes: [] };
        throw new Error(`unexpected schema ${schemaName}`);
      },
    } as unknown as AdapterInput['structuredModel'],
    signal: new AbortController().signal,
  };

  await assert.rejects(
    () => new UnitAdapter().generate({
      ...input,
      plan: buildPlan(),
      approval: { decision: 'approve', answers: {} },
    }),
    /did not return a change for scoped behavior/i,
  );
});

test('unit generation retries invalid tautology and accepts a meaningful production-module test', async () => {
  const repoRoot = await createRepo({
    scripts: { test: 'vitest run' },
    devDependencies: { vitest: '^2.0.0' },
  });
  const session = buildSession(repoRoot);
  const repository = buildRepository(repoRoot);
  const contexts: unknown[] = [];
  let attempt = 0;
  const input: AdapterInput = {
    session,
    repository,
    emit: async event => event,
    modelConnect: null,
    skills: { load: async name => ({ name, content: `# ${name}` }) } as AdapterInput['skills'],
    structuredModel: {
      runStep: async ({ schemaName, context }: { schemaName: string; context: unknown }) => {
        assert.equal(schemaName, 'GenerationChanges');
        contexts.push(context);
        attempt += 1;
        const content = attempt === 1
          ? "import { expect, it } from 'vitest';\nit('fake', () => expect(true).toBe(true));\n"
          : "import { expect, it } from 'vitest';\nimport { calculateCartTotal } from './cart';\nit('multiplies item price by quantity', () => expect(calculateCartTotal([{ price: 5, quantity: 2 }])).toBe(10));\n";
        return {
          changes: [{
            id: 'cart-total',
            action: 'Add',
            testType: 'Unit',
            title: 'Cart totals include item quantity',
            file: 'src/cart.test.ts',
            feature: 'Cart',
            risk: 'High',
            reason: 'Covers cart quantity totals.',
            diff: [{ kind: 'add', text: content }],
            content,
            status: 'staged',
          }],
        };
      },
    } as unknown as AdapterInput['structuredModel'],
    signal: new AbortController().signal,
  };

  const generation = await new UnitAdapter().generate({
    ...input,
    plan: buildPlan(),
    approval: { decision: 'approve', answers: {} },
  });

  assert.equal(attempt, 2);
  assert.equal(generation.changes.length, 1);
  assert.match(generation.changes[0]?.content ?? '', /calculateCartTotal/);
  assert.match(JSON.stringify(contexts[1]), /tautological assertion/i);
});

test('unit generation falls back to thinker when coder returns no assistant content', async () => {
  const repoRoot = await createRepo({
    scripts: { test: 'vitest run' },
    devDependencies: { vitest: '^2.0.0' },
  });
  const session = buildSession(repoRoot);
  const repository = buildRepository(repoRoot);
  const events: string[] = [];
  const profiles: string[] = [];
  const input: AdapterInput = {
    session,
    repository,
    emit: async event => {
      if (event.type === 'progress') events.push(event.message);
      return event;
    },
    modelConnect: null,
    skills: { load: async name => ({ name, content: `# ${name}` }) } as AdapterInput['skills'],
    structuredModel: {
      runStep: async ({ profile }: { profile: string }) => {
        profiles.push(profile);
        if (profile === 'coder') {
          throw new Error('LLM response did not contain assistant content');
        }
        const content = "import { expect, it } from 'vitest';\nimport { calculateCartTotal } from './cart';\nit('multiplies item price by quantity', () => expect(calculateCartTotal([{ price: 5, quantity: 2 }])).toBe(10));\n";
        return {
          changes: [{
            id: 'cart-total',
            action: 'Add',
            testType: 'Unit',
            title: 'Cart totals include item quantity',
            file: 'src/cart.test.ts',
            feature: 'Cart',
            risk: 'High',
            reason: 'Covers cart quantity totals.',
            diff: [{ kind: 'add', text: content }],
            content,
            status: 'staged',
          }],
        };
      },
    } as unknown as AdapterInput['structuredModel'],
    signal: new AbortController().signal,
  };

  const result = await new UnitAdapter().generate({
    ...input,
    plan: buildPlan(),
    approval: { decision: 'approve', answers: {} },
  });

  assert.deepEqual(profiles, ['coder', 'thinker']);
  assert.equal(result.changes.length, 1);
  assert.match(result.changes[0]?.content ?? '', /calculateCartTotal/);
  assert.ok(events.some(message => /Generating unit test 1\/1: Cart totals include item quantity \(attempt 1\/2\)/.test(message)));
  assert.ok(events.some(message => /Coder model response failed for "Cart totals include item quantity".*falling back to thinker model/i.test(message)));
  assert.ok(!events.some(message => /retrying with validation feedback/i.test(message)));
});

test('unit generation fans out one request per behavior with concurrency limited to two', async () => {
  const repoRoot = await createRepo({
    scripts: { test: 'vitest run' },
    devDependencies: { vitest: '^2.0.0' },
  });
  const session = buildSession(repoRoot);
  session.isolation!.classifications = [
    ...session.isolation!.classifications,
    {
      behavior: 'Cart removes an item',
      status: 'Missing',
      suggestedTypes: ['Unit'],
      risk: 'Medium',
      explanation: 'No removal test.',
    },
    {
      behavior: 'Cart clears all items',
      status: 'Missing',
      suggestedTypes: ['Unit'],
      risk: 'Medium',
      explanation: 'No clear test.',
    },
  ];
  const repository = buildRepository(repoRoot);
  const requestedBehaviors: string[][] = [];
  let active = 0;
  let maxActive = 0;
  const input: AdapterInput = {
    session,
    repository,
    emit: async event => event,
    modelConnect: null,
    skills: { load: async name => ({ name, content: `# ${name}` }) } as AdapterInput['skills'],
    structuredModel: {
      runStep: async ({ context }: { context: { generationScope: { behaviorsToStage: Array<{ behavior: string; file: string; risk: string }> } } }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const scoped = context.generationScope.behaviorsToStage;
        requestedBehaviors.push(scoped.map(item => item.behavior));
        await new Promise(resolve => setTimeout(resolve, 10));
        active -= 1;
        const item = scoped[0]!;
        const symbol = item.behavior.includes('removes')
          ? 'removeCartItem'
          : item.behavior.includes('clears')
            ? 'clearCart'
            : 'calculateCartTotal';
        const content = `import { expect, it } from 'vitest';\nimport { ${symbol} } from './cart';\nit('${item.behavior}', () => expect(${symbol}()).toBeDefined());\n`;
        return {
          changes: [{
            id: item.behavior,
            action: 'Add',
            testType: 'Unit',
            title: item.behavior,
            file: item.file,
            feature: 'Cart',
            risk: item.risk,
            reason: 'Generated per behavior.',
            diff: [{ kind: 'add', text: content }],
            content,
            status: 'staged',
          }],
        };
      },
    } as unknown as AdapterInput['structuredModel'],
    signal: new AbortController().signal,
  };

  const result = await new UnitAdapter().generate({
    ...input,
    plan: { ...buildPlan(), proposedActions: [{ action: 'add', label: 'Add missing unit tests', count: 3 }] },
    approval: { decision: 'approve', answers: {} },
  });

  assert.equal(result.changes.length, 3);
  assert.equal(maxActive, 2);
  assert.equal(requestedBehaviors.length, 3);
  assert.ok(requestedBehaviors.every(behaviors => behaviors.length === 1));
});

test('unit generation accepts a paraphrased title for a single scoped behavior', async () => {
  const repoRoot = await createRepo({
    scripts: { test: 'vitest run' },
    devDependencies: { vitest: '^2.0.0' },
  });
  const session = buildSession(repoRoot);
  session.isolation!.classifications = [{
    behavior: 'Checkout submission flow (cart empty check, order number generation, and localStorage persistence)',
    status: 'Missing',
    suggestedTypes: ['Unit'],
    risk: 'High',
    explanation: 'Missing checkout submission coverage.',
  }];
  const repository = buildRepository(repoRoot);
  const content = "import { expect, it } from 'vitest';\nimport { submitCheckout } from './cart';\nit('submits checkout', () => expect(submitCheckout()).toBeDefined());\n";
  const input: AdapterInput = {
    session,
    repository,
    emit: async event => event,
    modelConnect: null,
    skills: { load: async name => ({ name, content: `# ${name}` }) } as AdapterInput['skills'],
    structuredModel: {
      runStep: async () => ({
        changes: [{
          id: 'checkout-submission',
          action: 'Add',
          testType: 'Unit',
          title: 'Checkout submission behavior',
          file: 'src/generated-checkout.test.ts',
          feature: 'Cart',
          risk: 'Medium',
          reason: 'Covers checkout submission.',
          diff: [{ kind: 'add', text: content }],
          content,
          status: 'staged',
        }],
      }),
    } as unknown as AdapterInput['structuredModel'],
    signal: new AbortController().signal,
  };

  const result = await new UnitAdapter().generate({
    ...input,
    plan: buildPlan(),
    approval: { decision: 'approve', answers: {} },
  });

  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0]?.title, session.isolation.classifications[0]!.behavior);
  assert.equal(result.changes[0]?.file, 'src/cart.test.ts');
  assert.equal(result.changes[0]?.risk, 'High');
});
