import type { IsolationResult, TestPlan } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

const FORBIDDEN_QUESTION_PATTERNS = [
  /\bplaywright\b/i,
  /\bcypress\b/i,
  /\bselenium\b/i,
  /\bvitest\b/i,
  /\bjsdom\b/i,
  /\btesting library\b/i,
  /\btest(?:ing)? environment\b/i,
  /\btest framework\b/i,
  /\bwhich (?:tool|framework|runner)\b/i,
  /\bhow (?:should|do) we (?:do|run) (?:the )?ui\b/i,
  /\bagent-browser\b/i,
];

const ROUTE_QUESTION_PATTERNS = [
  /\burl\b/i,
  /\broute\b/i,
  /\bhomepage\b/i,
  /\bapp\.tsx\b/i,
  /\bcomponent structure\b/i,
  /\bmain app component\b/i,
  /\bwhat is the .{0,20}path\b/i,
];

const IMPLEMENTATION_QUESTION_PATTERNS = [
  /\bcart state\b/i,
  /\bredux\b/i,
  /\bcontext api\b/i,
  /\bhow is .{0,40} loaded\b/i,
  /\bapi call\b/i,
  /\bmock server\b/i,
  /\btest.?id\b/i,
  /\bdata-testid\b/i,
  /\baccessible names\b/i,
];

function hasRouteEvidence(isolation: IsolationResult, repository: RepositoryContext): boolean {
  if (repository.frontend?.route || repository.frontend?.url) return true;
  if (isolation.userJourneys.length > 0) return true;
  return isolation.sourceFiles.some(file => /\/pages\//i.test(file.path));
}

function hasSourceEvidence(repository: RepositoryContext): boolean {
  return repository.sourceSnippets.length > 0 || repository.relatedFiles.length > 0;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

function questionText(question: TestPlan['questions'][number]): string {
  return `${question.question} ${question.options.join(' ')}`;
}

export function filterPlanQuestions(
  questions: TestPlan['questions'],
  isolation: IsolationResult,
  repository: RepositoryContext,
): TestPlan['questions'] {
  const routeEvidence = hasRouteEvidence(isolation, repository);
  const sourceEvidence = hasSourceEvidence(repository);

  return questions.filter(question => {
    const text = questionText(question);
    if (matchesAny(text, FORBIDDEN_QUESTION_PATTERNS)) return false;
    if (routeEvidence && matchesAny(text, ROUTE_QUESTION_PATTERNS)) return false;
    if (sourceEvidence && matchesAny(text, IMPLEMENTATION_QUESTION_PATTERNS)) return false;
    return true;
  });
}
