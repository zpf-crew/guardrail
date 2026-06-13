import type { PlanApproval, TestPlan } from '../workbench.types.js';

export interface ResolvedPlanAnswer {
  questionId: string;
  question: string;
  selectedOption: string;
  selectedIndex: number;
}

export function resolvePlanAnswers(plan: TestPlan, approval: PlanApproval): ResolvedPlanAnswer[] {
  const resolved: ResolvedPlanAnswer[] = [];
  for (const question of plan.questions) {
    const index = approval.answers[question.id];
    if (typeof index !== 'number') continue;
    const selectedOption = question.options[index];
    if (!selectedOption) continue;
    resolved.push({
      questionId: question.id,
      question: question.question,
      selectedOption,
      selectedIndex: index,
    });
  }
  return resolved;
}

export function countUnresolvedPlanQuestions(plan: TestPlan, approval: PlanApproval): number {
  return plan.questions.filter(question => typeof approval.answers[question.id] !== 'number').length;
}
