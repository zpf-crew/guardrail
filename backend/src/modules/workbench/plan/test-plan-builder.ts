import type { IntentInput, IsolationResult, TestPlan } from '../workbench.types.js';
import {
  buildDefaultRunConstraints,
  inferHeavyRunConstraints,
  mergeRunConstraintOverrides,
} from './run-constraints.js';

function slugFeature(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feature';
}

function deriveTestFiles(intent: IntentInput, isolation: IsolationResult): string[] {
  const slug = slugFeature(isolation.target.feature || intent.feature || 'tests');
  const primary = `guardrail-tests/ui/${slug}.feature`;
  const existing = isolation.existingTestFiles.map(file => file.path);
  return existing.length > 0 ? [...new Set([...existing, primary])] : [primary];
}

export function buildTestPlan(
  intent: IntentInput,
  isolation: IsolationResult,
  questions: TestPlan['questions'] = [],
  runConstraintOverrides: TestPlan['runConstraints'] = [],
): TestPlan {
  const missing = isolation.classifications.filter(item => item.status === 'Missing');
  const weak = isolation.classifications.filter(item => item.status === 'Weak');
  const failed = isolation.classifications.filter(item => item.status === 'Failed');
  const suspicious = isolation.classifications.filter(item => item.status === 'Suspicious');

  const proposedActions: TestPlan['proposedActions'] = [];
  if (missing.length > 0) {
    proposedActions.push({
      action: 'add',
      label: `Add tests for ${missing.length} missing behaviors`,
      count: missing.length,
      items: missing.map(item => item.behavior),
    });
  }
  if (weak.length > 0) {
    proposedActions.push({
      action: 'update',
      label: `Strengthen ${weak.length} weak tests`,
      count: weak.length,
      items: weak.map(item => item.behavior),
    });
  }
  if (failed.length > 0) {
    proposedActions.push({
      action: 'run',
      label: `Investigate ${failed.length} failed tests`,
      count: failed.length,
      items: failed.map(item => item.behavior),
    });
  }
  if (suspicious.length > 0) {
    proposedActions.push({
      action: 'update',
      label: `Review ${suspicious.length} suspicious tests`,
      count: suspicious.length,
      items: suspicious.map(item => item.behavior),
    });
  }
  if (proposedActions.length === 0) {
    proposedActions.push({
      action: 'add',
      label: 'Add tests for isolated behaviors',
      count: isolation.classifications.length,
      items: isolation.classifications.map(item => item.behavior),
    });
  }

  const wantsUi = intent.testTypes.includes('UI / Browser');
  const wantsMobile = intent.testTypes.includes('Mobile');

  const behaviors = proposedActions.flatMap(action => action.items ?? []);
  const runConstraints = mergeRunConstraintOverrides(
    inferHeavyRunConstraints(buildDefaultRunConstraints(behaviors)),
    runConstraintOverrides,
  );

  return {
    proposedActions,
    risk: {
      productionCodeChanges: 'none',
      testDataChanges: false,
      browserAutomationRequired: wantsUi,
      mobileSimulatorRequired: wantsMobile ? 'required' : 'no',
      externalApiMocking: 'optional',
    },
    filesToChange: deriveTestFiles(intent, isolation),
    questions,
    runConstraints,
  };
}
