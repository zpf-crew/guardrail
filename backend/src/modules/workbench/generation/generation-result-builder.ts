import type { GeneratedChange, GenerationResult, IntentInput, IsolationResult, TestPlan } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';
import { deriveGenerationScope, type ScopedBehavior } from './generation-scope.js';

type SnippetRepository = Pick<RepositoryContext, 'sourceSnippets'>;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
}

function titlesMatch(changeTitle: string, behavior: string): boolean {
  const left = changeTitle.trim().toLowerCase();
  const right = behavior.trim().toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

function isMeaningfulButtonLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed.length > 0;
}

function extractButtonLabelFromSnippetText(text: string): string | undefined {
  const patterns = [
    /<button[^>]*>([\s\S]*?)<\/button>/i,
    /aria-label=["']([^"']+)["']/i,
    /<label[^>]*>([\s\S]*?)<\/label>/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const label = match[1].replace(/<[^>]+>/g, '').trim();
    if (isMeaningfulButtonLabel(label)) return label;
  }

  return undefined;
}

function findButtonLabelFromSnippets(repository?: SnippetRepository): string | undefined {
  if (!repository) return undefined;

  for (const snippet of repository.sourceSnippets) {
    const label = extractButtonLabelFromSnippetText(snippet.text);
    if (label) return label;
  }

  return undefined;
}

function buildWhenStep(repository?: SnippetRepository): string {
  const buttonLabel = findButtonLabelFromSnippets(repository);
  return buttonLabel
    ? `    When the user clicks ${buttonLabel}`
    : '    When the user completes the primary flow';
}

function fallbackChangeForScope(
  scope: ScopedBehavior,
  intent: IntentInput,
  isolation: IsolationResult,
  repository?: SnippetRepository,
): GeneratedChange {
  const slug = slugify(scope.behavior);

  return {
    id: slug,
    action: scope.action,
    testType: 'UI / Browser',
    title: scope.behavior,
    file: scope.file,
    feature: isolation.target.feature,
    risk: scope.risk,
    reason: scope.action === 'Update'
      ? 'Fallback update scenario staged from approved plan because model output did not cover this behavior.'
      : 'Fallback scenario staged from approved plan because model output did not cover this behavior.',
    diff: [
      { kind: 'add', text: `Feature: ${isolation.target.feature}` },
      { kind: 'add', text: `  Scenario: ${scope.behavior}` },
      { kind: 'add', text: '    Given the user opens the target page' },
      { kind: 'add', text: buildWhenStep(repository) },
      { kind: 'add', text: '    Then the expected UI state is visible' },
    ],
    status: 'staged',
  };
}

function normalizeModelChange(change: GeneratedChange, scope: ScopedBehavior, isolation: IsolationResult): GeneratedChange {
  return {
    ...change,
    action: scope.action,
    title: change.title.trim() || scope.behavior,
    file: change.file.trim() || scope.file,
    feature: change.feature || isolation.target.feature,
    risk: change.risk || scope.risk,
    testType: 'UI / Browser',
    status: 'staged',
  };
}

export function resolveGenerationChanges(
  intent: IntentInput,
  isolation: IsolationResult,
  plan: TestPlan,
  modelChanges: GeneratedChange[],
  repository?: SnippetRepository,
): GeneratedChange[] {
  const scope = deriveGenerationScope(isolation, plan);
  if (scope.length === 0) {
    if (modelChanges.length > 0) return modelChanges;
    const behavior = isolation.classifications[0]?.behavior ?? (intent.prompt || 'Isolated behavior');
    return [fallbackChangeForScope({
      behavior,
      status: isolation.classifications[0]?.status ?? 'Missing',
      action: 'Add',
      risk: isolation.classifications[0]?.risk ?? 'Medium',
      file: plan.filesToChange[0] ?? 'guardrail-tests/ui/generated.feature',
    }, intent, isolation, repository)];
  }

  const used = new Set<number>();
  const resolved: GeneratedChange[] = [];

  for (const item of scope) {
    const matchIndex = modelChanges.findIndex((change, index) =>
      !used.has(index) && titlesMatch(change.title, item.behavior));
    if (matchIndex >= 0) {
      used.add(matchIndex);
      resolved.push(normalizeModelChange(modelChanges[matchIndex]!, item, isolation));
      continue;
    }
    resolved.push(fallbackChangeForScope(item, intent, isolation, repository));
  }

  for (let index = 0; index < modelChanges.length; index += 1) {
    if (!used.has(index)) resolved.push(modelChanges[index]!);
  }

  return resolved;
}

export function buildGenerationResult(
  intent: IntentInput,
  isolation: IsolationResult,
  plan: TestPlan,
  changes: GeneratedChange[],
  repository?: SnippetRepository,
): GenerationResult {
  const resolvedChanges = resolveGenerationChanges(intent, isolation, plan, changes, repository);

  return {
    timeline: [
      { label: 'Map plan actions to browser scenarios', status: 'done' },
      { label: `Stage ${resolvedChanges.length} test artifact${resolvedChanges.length === 1 ? '' : 's'}`, status: 'done' },
    ],
    changes: resolvedChanges,
    beforeAfter: {
      before: [`No generated changes for: ${intent.prompt || isolation.target.feature}`],
      after: resolvedChanges.map(change => `${change.action} ${change.testType} — ${change.title}`),
    },
  };
}
