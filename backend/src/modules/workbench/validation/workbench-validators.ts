import { z } from 'zod';
import type {
  GenerationResult,
  IsolationResult,
  ReviewSummary,
  TestPlan,
  TestRunResult,
} from '../workbench.types.js';

const testTypeSchema = z.enum([
  'Unit',
  'Integration',
  'E2E',
  'Contract',
  'Regression',
  'Edge Case',
  'Security',
  'UI / Browser',
  'Visual Screenshot',
  'Mobile',
]);

const riskSchema = z.enum(['Low', 'Medium', 'High', 'Critical']);

const repoSchema = z.object({
  name: z.string(),
  path: z.string(),
  branch: z.string(),
  commit: z.string().optional(),
});

const relatedFileSchema = z.object({
  path: z.string(),
  kind: z.enum(['source', 'test', 'spec', 'qc']),
  meta: z.string().optional(),
});

const qcCaseSchema = z.object({
  id: z.string(),
  feature: z.string(),
  scenario: z.string(),
  expectedResult: z.string(),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']),
  automationStatus: z.enum(['automated', 'missing', 'unknown']),
});

const classificationSchema = z.object({
  behavior: z.string(),
  status: z.enum(['Covered', 'Missing', 'Weak', 'Failed', 'Suspicious']),
  suggestedTypes: z.array(testTypeSchema),
  risk: riskSchema,
  explanation: z.string(),
});

const isolationClassificationsSchema = z.object({
  classifications: z.array(classificationSchema).min(1),
});

const isolationSchema = z.object({
  target: z.object({ feature: z.string(), repo: repoSchema }),
  sourceFiles: z.array(relatedFileSchema),
  existingTestFiles: z.array(relatedFileSchema),
  specDocs: z.array(relatedFileSchema),
  qcCases: z.array(qcCaseSchema),
  currentCoverage: z.object({ line: z.number(), branch: z.number() }),
  currentStatus: z.object({
    failed: z.number(),
    suspicious: z.number(),
    missing: z.number(),
    flaky: z.number().optional(),
  }),
  userJourneys: z.array(z.string()),
  classifications: z.array(classificationSchema),
});

const behaviorRunConstraintsSchema = z.object({
  behavior: z.string(),
  maxStepDurationMs: z.number().int().positive(),
  maxSteps: z.number().int().positive(),
  reason: z.string().optional(),
});

const agentBrowserCommandSchema = z.object({
  kind: z.literal('agentBrowserCommand'),
  command: z.string().min(1),
  args: z.array(z.string()).max(12),
  reason: z.string().min(1),
});

const uiBrowserAgentActionSchema = z.discriminatedUnion('kind', [
  agentBrowserCommandSchema,
  z.object({ kind: z.literal('stepComplete'), stepIndex: z.number().int().nonnegative(), note: z.string() }),
  z.object({
    kind: z.literal('assertThen'),
    stepIndex: z.number().int().nonnegative(),
    satisfied: z.boolean(),
    reason: z.string(),
  }),
  z.object({ kind: z.literal('stepFailed'), stepIndex: z.number().int().nonnegative(), reason: z.string() }),
  z.object({ kind: z.literal('scenarioComplete') }),
]);

const uiBrowserScenarioPlanStepSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['setup', 'action', 'assert']),
  sourceStepIndexes: z.array(z.number().int().nonnegative()).default([]),
  instruction: z.string().min(1),
  successCriteria: z.string().min(1).optional(),
});

const uiBrowserScenarioPlanSchema = z.object({
  title: z.string().min(1),
  steps: z.array(uiBrowserScenarioPlanStepSchema).min(1).max(12),
});

const planSchema = z.object({
  proposedActions: z.array(z.object({
    action: z.enum(['add', 'update', 'delete', 'run']),
    label: z.string(),
    count: z.number().nullable(),
    items: z.array(z.string()).optional(),
  })),
  risk: z.object({
    productionCodeChanges: z.enum(['none', 'expected']),
    testDataChanges: z.boolean(),
    browserAutomationRequired: z.boolean(),
    mobileSimulatorRequired: z.enum(['required', 'optional', 'no']),
    externalApiMocking: z.enum(['required', 'optional', 'no']),
  }),
  filesToChange: z.array(z.string()),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    answerIndex: z.number().optional(),
  })),
  runConstraints: z.array(behaviorRunConstraintsSchema).optional(),
});

const planQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  answerIndex: z.number().optional(),
});

const testPlanQuestionsSchema = z.object({
  questions: z.array(planQuestionSchema),
  runConstraintOverrides: z.array(behaviorRunConstraintsSchema).optional(),
});

const diffLineSchema = z.object({
  kind: z.enum(['add', 'del', 'context', 'meta']),
  text: z.string(),
});

const generatedChangeSchema = z.object({
  id: z.string(),
  action: z.enum(['Add', 'Update', 'Delete']),
  testType: testTypeSchema,
  title: z.string(),
  file: z.string(),
  feature: z.string(),
  risk: riskSchema,
  reason: z.string(),
  diff: z.array(diffLineSchema),
  content: z.string().optional(),
  status: z.enum(['staged', 'applied', 'reverted']),
});

const generationSchema = z.object({
  timeline: z.array(z.object({
    label: z.string(),
    status: z.enum(['pending', 'running', 'done']),
  })),
  changes: z.array(generatedChangeSchema),
  beforeAfter: z.object({
    before: z.array(z.string()),
    after: z.array(z.string()),
  }),
});

const generationChangesSchema = z.object({
  changes: z.array(generatedChangeSchema),
});

const outcomeSchema = z.enum(['Passed', 'Failed', 'Flaky', 'Skipped', 'Needs approval']);

const evidenceSchema = z.object({
  kind: z.enum(['screenshot', 'video', 'trace', 'device-log', 'visual-diff']),
  label: z.string(),
  href: z.string().optional(),
});

const runSchema = z.object({
  unit: z.object({
    command: z.string(),
    outcome: outcomeSchema,
    passed: z.number(),
    failed: z.number().optional(),
    durationMs: z.number(),
    suite: z.string(),
  }),
  ui: z.object({
    command: z.string(),
    browser: z.string(),
    outcome: outcomeSchema,
    passed: z.number(),
    durationMs: z.number(),
    visual: z.object({ matchPercent: z.number(), baseline: z.string() }).optional(),
    evidence: z.array(evidenceSchema),
  }),
  mobile: z.object({
    command: z.string(),
    devices: z.array(z.string()),
    network: z.string().optional(),
    outcome: outcomeSchema,
    passed: z.number(),
    flaky: z.number().optional(),
    durationMs: z.number(),
    evidence: z.array(evidenceSchema),
  }),
  coverage: z.array(z.object({
    metric: z.enum(['Line coverage', 'Branch coverage', 'Function coverage', 'Changed-files']),
    before: z.number(),
    after: z.number(),
  })),
  matrix: z.array(z.object({
    title: z.string(),
    type: testTypeSchema,
    status: outcomeSchema,
    duration: z.string().nullable(),
    evidence: z.string().nullable(),
    evidenceItems: z.array(evidenceSchema).optional(),
    reason: z.string().nullable(),
    file: z.string(),
  })),
  attention: z.object({
    testTitle: z.string(),
    kind: z.enum(['failed', 'flaky']),
    reason: z.string(),
    likelyCause: z.string(),
    suggestedFix: z.string(),
    actions: z.array(z.enum(['ask-agent-to-fix', 'accept-and-keep', 'revert-generated-test'])),
  }).optional(),
});

const reviewRecommendationSchema = z.object({
  recommendation: z.string().min(1),
});

const reviewSchema = z.object({
  testsAdded: z.number(),
  testsUpdated: z.number(),
  testsDeleted: z.number(),
  testsPassing: z.string(),
  coverage: z.object({ lineDelta: z.number(), branchDelta: z.number() }),
  flakyTracked: z.number(),
  filesChanged: z.array(z.object({
    path: z.string(),
    diffStat: z.string(),
    changeKind: z.enum(['add', 'update', 'delete']),
  })),
  remainingRisk: z.array(z.object({
    label: z.string(),
    value: z.string(),
    sentiment: z.enum(['good', 'bad', 'neutral']),
  })),
  openQuestions: z.number(),
  recommendation: z.string(),
});

const unitRunPlanSchema = z.object({
  packageRoot: z.string(),
  generatedTestPath: z.string(),
  focused: z.boolean(),
  setupNotes: z.array(z.string()),
  expectedRunner: z.enum(['node:test', 'vitest', 'jest', 'unknown']),
});

const schemas = {
  IsolationResult: isolationSchema,
  IsolationClassifications: isolationClassificationsSchema,
  TestPlan: planSchema,
  TestPlanQuestions: testPlanQuestionsSchema,
  GenerationResult: generationSchema,
  GenerationChanges: generationChangesSchema,
  TestRunResult: runSchema,
  ReviewSummary: reviewSchema,
  ReviewRecommendation: reviewRecommendationSchema,
  UnitRunPlan: unitRunPlanSchema,
  UiBrowserScenarioPlan: uiBrowserScenarioPlanSchema,
} as const;

interface WorkbenchStepResultByName {
  IsolationResult: IsolationResult;
  IsolationClassifications: { classifications: IsolationResult['classifications'] };
  TestPlan: TestPlan;
  TestPlanQuestions: {
    questions: TestPlan['questions'];
    runConstraintOverrides?: TestPlan['runConstraints'];
  };
  GenerationResult: GenerationResult;
  GenerationChanges: { changes: GenerationResult['changes'] };
  TestRunResult: TestRunResult;
  ReviewSummary: ReviewSummary;
  ReviewRecommendation: { recommendation: string };
  UnitRunPlan: z.infer<typeof unitRunPlanSchema>;
  UiBrowserScenarioPlan: UiBrowserScenarioPlan;
}

export type WorkbenchSchemaName = keyof typeof schemas;
export type UiBrowserAgentAction = z.infer<typeof uiBrowserAgentActionSchema>;
export type UiBrowserScenarioPlan = z.infer<typeof uiBrowserScenarioPlanSchema>;
export type BehaviorRunConstraints = z.infer<typeof behaviorRunConstraintsSchema>;
export type UnitRunPlan = z.infer<typeof unitRunPlanSchema>;

export function validateUiBrowserAgentAction(value: unknown): UiBrowserAgentAction {
  const result = uiBrowserAgentActionSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`UiBrowserAgentAction validation failed: ${formatIssues(result.error.issues)}`);
  }
  return result.data;
}

export function validateUnitRunPlan(value: unknown): UnitRunPlan {
  const result = unitRunPlanSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`UnitRunPlan validation failed: ${formatIssues(result.error.issues)}`);
  }
  return result.data;
}

export function validateWorkbenchStepResult<TName extends WorkbenchSchemaName>(
  schemaName: TName,
  value: unknown,
): WorkbenchStepResultByName[TName] {
  const result = schemas[schemaName].safeParse(value);
  if (!result.success) {
    throw new Error(`${schemaName} validation failed: ${formatIssues(result.error.issues)}`);
  }

  return result.data as WorkbenchStepResultByName[TName];
}

function formatIssues(issues: z.ZodIssue[]): string {
  return issues
    .map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(', ');
}
