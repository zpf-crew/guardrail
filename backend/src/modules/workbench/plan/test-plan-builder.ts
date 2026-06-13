import type { IntentInput, IsolationResult, TestPlan } from '../workbench.types.js';

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
): TestPlan {
  const missing = isolation.classifications.filter(item => item.status === 'Missing');
  const weak = isolation.classifications.filter(item => item.status === 'Weak');
  const failed = isolation.classifications.filter(item => item.status === 'Failed');
  const suspicious = isolation.classifications.filter(item => item.status === 'Suspicious');

  const proposedActions: TestPlan['proposedActions'] = [];
  if (missing.length > 0) {
    proposedActions.push({ action: 'add', label: `Add tests for ${missing.length} missing behaviors`, count: missing.length });
  }
  if (weak.length > 0) {
    proposedActions.push({ action: 'update', label: `Strengthen ${weak.length} weak tests`, count: weak.length });
  }
  if (failed.length > 0) {
    proposedActions.push({ action: 'run', label: `Investigate ${failed.length} failed tests`, count: failed.length });
  }
  if (suspicious.length > 0) {
    proposedActions.push({ action: 'update', label: `Review ${suspicious.length} suspicious tests`, count: suspicious.length });
  }
  if (proposedActions.length === 0) {
    proposedActions.push({
      action: 'add',
      label: 'Add tests for isolated behaviors',
      count: isolation.classifications.length,
    });
  }

  const wantsUi = intent.testTypes.includes('UI / Browser');
  const wantsMobile = intent.testTypes.includes('Mobile');

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
  };
}
