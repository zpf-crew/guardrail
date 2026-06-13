import type { DashboardPayload, FeatureModule, QuickAction, TestType } from '@/types/testlens';

const DEFAULT_FEATURES: FeatureModule[] = ['Coupon', 'Payment', 'Checkout'];

/** Map onboarding dashboard insights into Intent-step quick actions. */
export function quickActionsFromDashboard(dashboard: DashboardPayload): QuickAction[] {
  const testCasesById = new Map(dashboard.testCases.map(tc => [tc.id, tc]));

  return dashboard.insights.map(insight => {
    const related = insight.relatedTestIds
      .map(id => testCasesById.get(id))
      .filter((tc): tc is NonNullable<typeof tc> => tc !== undefined);

    const features = [...new Set(related.map(tc => tc.feature).filter(Boolean))];
    const testTypes = [...new Set(related.map(tc => tc.type).filter(Boolean))] as TestType[];

    const feature = (features[0] ?? featureFromMeta(insight.meta) ?? 'General') as FeatureModule;

    return {
      id: `QA-${insight.id}`,
      label: insightLabel(insight.action, insight.title),
      feature,
      severity: insight.severity,
      testTypes: testTypes.length > 0 ? [testTypes[0]!] : [defaultTestTypesForAction(insight.action)[0]!],
      sourceInsightId: insight.id,
    };
  });
}

/** Distinct feature modules from scanned test cases, with a sensible fallback. */
export function featureOptionsFromDashboard(dashboard: DashboardPayload): FeatureModule[] {
  const fromTests = [...new Set(dashboard.testCases.map(tc => tc.feature).filter(Boolean))];
  const fromStructure = dashboard.structure.map(node => node.name).filter(Boolean);
  const merged = [...new Set([...fromTests, ...fromStructure])] as FeatureModule[];

  return merged.length > 0 ? merged : DEFAULT_FEATURES;
}

export function fallbackFeatureOptions(): FeatureModule[] {
  return DEFAULT_FEATURES;
}

function insightLabel(action: string, title: string): string {
  const normalizedAction = action.trim();
  const normalizedTitle = title.trim();
  if (!normalizedAction) return normalizedTitle;
  if (normalizedTitle.toLowerCase().startsWith(normalizedAction.toLowerCase())) {
    return normalizedTitle;
  }
  return `${normalizedAction}: ${normalizedTitle}`;
}

function featureFromMeta(meta?: string): string | undefined {
  if (!meta) return undefined;
  const match = meta.match(/·\s*([^·]+)\s*$/);
  return match?.[1]?.trim();
}

function defaultTestTypesForAction(action: string): TestType[] {
  if (/ui|browser/i.test(action)) return ['UI / Browser'];
  if (/mobile/i.test(action)) return ['Mobile'];
  if (/integration/i.test(action)) return ['Integration'];
  return ['Unit'];
}
