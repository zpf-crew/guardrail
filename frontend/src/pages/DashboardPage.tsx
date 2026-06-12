import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Panel } from '@/components/ui/panel';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { TestCase, Insight, TestStatus, HealthMetrics } from '@/types/testlens';
import { useDashboard } from '@/pages/dashboard/use-dashboard';
import { DashboardSkeleton, DashboardEmpty, DashboardError } from '@/pages/dashboard/dashboard-states';
import { formatRelativeTime } from '@/lib/format-relative-time';
import { formatPercent } from '@/lib/format-percent';
import { trendPresentation } from '@/lib/trend-presentation';
import { startScan } from '@/data/scan-api';
import { exportDashboardReport } from '@/lib/export-dashboard-report';
import { useAuth } from '@/app/auth-context';
import {
  TEST_STATUS_VIEW,
  TEST_STATUS_COLOR,
  RISK_COLOR,
  SEVERITY_VIEW,
  STRUCTURE_KIND_COLOR,
} from '@/pages/dashboard/status-presentation';
import {
  PlayIcon,
  SparklesIcon,
  DownloadIcon,
  SearchIcon,
  AlertCircleIcon,
  LightbulbIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TestStatusIcon,
} from '@/components/icons';

function FilterSelect({ value, onChange, children }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return (
    <select
      className="appearance-none bg-[#161a24] border border-[rgba(255,255,255,0.07)] text-[#e8ebf2] text-[12.5px] px-[11px] py-[6px] pr-[28px] rounded-[8px] cursor-pointer outline-none transition-colors hover:border-[rgba(255,255,255,0.12)] focus:border-[rgba(129,140,248,0.35)]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2398a1b3' stroke-width='2'%3E%3Cpath d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 9px center',
      }}
      value={value}
      onChange={onChange}
    >
      {children}
    </select>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-[12px] mb-[14px] mt-[6px] mx-[2px]">
      <h2 className="text-[15px] font-[650] m-0 tracking-[-0.1px] text-white">{title}</h2>
      {subtitle && <span className="text-[12.5px] text-[#6b7488]">{subtitle}</span>}
      <span className="flex-1 h-[1px] bg-[linear-gradient(90deg,rgba(255,255,255,0.07),transparent)]" />
    </div>
  );
}

function RunBars({ runs, status }: { runs: (0 | 1)[]; status: TestStatus }) {
  if (!runs.length) return <span className="text-[11px] text-[#6b7488] opacity-60">not run</span>;
  return (
    <div className="flex gap-[3px] items-end h-[16px]" title="last 5 runs">
      {runs.map((r, i) => (
        <span key={i} className="block rounded-[2px]" style={{ width: '4px', height: `${7 + i * 2.2}px`, background: r ? TEST_STATUS_COLOR[status] : 'rgba(255,255,255,0.13)' }} />
      ))}
    </div>
  );
}

function DeltaIcon({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  return dir === 'down'
    ? <ChevronDownIcon strokeWidth={2.5} className="w-[13px] h-[13px]" />
    : <ChevronUpIcon strokeWidth={2.5} className="w-[13px] h-[13px]" />;
}

/** Ordered display config for the 8 health metric tiles. */
const TILE_CONFIG: { key: keyof HealthMetrics; label: string; color: string }[] = [
  { key: 'totalTests', label: 'Total test cases', color: 'var(--accent)' },
  { key: 'passed', label: 'Passed', color: 'var(--pass)' },
  { key: 'failed', label: 'Failed', color: 'var(--fail)' },
  { key: 'flaky', label: 'Flaky', color: 'var(--flaky)' },
  { key: 'missing', label: 'Missing', color: 'var(--missing)' },
  { key: 'suspicious', label: 'Suspicious', color: 'var(--suspect)' },
  { key: 'coverage', label: 'Coverage', color: 'var(--accent-2)' },
  { key: 'highRiskOpen', label: 'High-risk open', color: 'var(--fail)' },
];

const ALL_STATUSES: TestStatus[] = ['passed', 'failed', 'flaky', 'missing', 'suspicious'];

/** Heatmap severity (0..3) → cell background. 0 = no issues (green). */
const HEAT_COLOR = ['rgba(61,220,151,0.22)', 'rgba(251,191,36,0.4)', 'rgba(251,113,133,0.55)', 'rgba(251,113,133,0.9)'];

export function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const { status, data, error, refetch } = useDashboard();

  const [search, setSearch] = React.useState('');
  const [groupBy, setGroupBy] = React.useState('Type');
  const [filterStatus, setFilterStatus] = React.useState('All');
  const [filterType, setFilterType] = React.useState('All');
  const [filterRisk, setFilterRisk] = React.useState('All');
  const [filterFeature, setFilterFeature] = React.useState('All');
  const [highlightedInsight, setHighlightedInsight] = React.useState<string | null>(null);
  const [highlightedTests, setHighlightedTests] = React.useState<Set<string>>(new Set());
  const [jumpTarget, setJumpTarget] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Scroll the Test Case Explorer to the test an insight points at.
  React.useEffect(() => {
    if (!jumpTarget) return;
    document.getElementById(`tc-${jumpTarget}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [jumpTarget]);

  const shellStyle = { fontFamily: 'var(--sans)' } as const;
  if (status === 'loading') {
    return <div className="min-h-screen" style={shellStyle}><TopBar user={user} onLogout={() => void logout()} /><DashboardSkeleton /></div>;
  }
  if (status === 'error' || !data) {
    return <div className="min-h-screen" style={shellStyle}><TopBar user={user} onLogout={() => void logout()} /><DashboardError message={error ?? 'Unknown error'} onRetry={refetch} /></div>;
  }
  if (status === 'empty') {
    return <div className="min-h-screen" style={shellStyle}><TopBar user={user} onLogout={() => void logout()} /><DashboardEmpty onRunScan={refetch} /></div>;
  }

  const { repo, lastScanAt, filesIndexed, health, metrics, testCases, insights, structure, coverage, riskHeatmap } = data;

  const features = [...new Set(testCases.map(tc => tc.feature))];
  const types = [...new Set(testCases.map(tc => tc.type))];

  const filtered = testCases.filter(tc => {
    if (search && !tc.title.toLowerCase().includes(search.toLowerCase()) && !tc.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'All' && tc.status !== filterStatus) return false;
    if (filterType !== 'All' && tc.type !== filterType) return false;
    if (filterRisk !== 'All' && tc.risk !== filterRisk) return false;
    if (filterFeature !== 'All' && tc.feature !== filterFeature) return false;
    return true;
  });

  const grouped: Record<string, TestCase[]> = {};
  filtered.forEach(tc => {
    const key = groupBy === 'Type' ? tc.type : groupBy === 'Feature' ? tc.feature : tc.status;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tc);
  });

  const handleInsightClick = (insight: Insight) => {
    // Reset filters so related tests aren't hidden, then highlight + jump to the first.
    setSearch('');
    setFilterStatus('All');
    setFilterType('All');
    setFilterRisk('All');
    setFilterFeature('All');
    setHighlightedInsight(insight.id);
    setHighlightedTests(new Set(insight.relatedTestIds));
    setJumpTarget(insight.relatedTestIds[0] ?? null);
    toast(`Highlighting ${insight.relatedTestIds.length} related tests`, 'success');
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('All');
    setFilterType('All');
    setFilterRisk('All');
    setFilterFeature('All');
    setHighlightedInsight(null);
    setHighlightedTests(new Set());
    setJumpTarget(null);
  };

  const hasFilters = search || filterStatus !== 'All' || filterType !== 'All' || filterRisk !== 'All' || filterFeature !== 'All' || highlightedInsight !== null;

  const handleRunScan = async () => {
    setScanning(true);
    toast('Scanning repository…', 'loading');
    try {
      await startScan();
      refetch();
      toast('Scan complete', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Scan failed', 'success');
    } finally {
      setScanning(false);
    }
  };

  const handleExport = () => {
    exportDashboardReport(data);
    toast('Report downloaded', 'success');
  };

  // Carry the originating insight into the workbench (consumed on that surface).
  const goToGenerate = (insight?: Insight) => {
    navigate('/tests', insight
      ? { state: { insightId: insight.id, action: insight.action, relatedTestIds: insight.relatedTestIds } }
      : undefined);
  };

  const donutColor = health.score >= 80 ? '#3ddc97' : health.score >= 60 ? '#fbbf24' : '#fb7185';
  const healthTrend = trendPresentation(health.trend);

  return (
    <div className="min-h-screen" style={{ fontFamily: 'var(--sans)' }}>
      <TopBar
        repo={repo.name}
        branch={repo.branch}
        scanTime={`${formatRelativeTime(lastScanAt)} · ${filesIndexed.toLocaleString()} files`}
        user={user}
        onLogout={() => void logout()}
        actions={
          <>
            <Button variant="outline" onClick={handleRunScan} disabled={scanning}>
              <PlayIcon className="w-[15px] h-[15px]" />
              {scanning ? 'Scanning…' : 'Run Scan'}
            </Button>
            <Button variant="primary" onClick={() => goToGenerate()}>
              <SparklesIcon className="w-[15px] h-[15px]" />
              Generate Tests
            </Button>
            <Button variant="ghost" onClick={handleExport}>
              <DownloadIcon className="w-[15px] h-[15px]" />
              Export Report
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-[1640px] p-[24px_26px_70px]">
        {/* Health Summary */}
        <div className="grid grid-cols-[300px_1fr] gap-[16px] mb-[26px]">
          <Panel className="p-[20px_22px] flex flex-col gap-[14px] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(120px_120px_at_80%_0%,rgba(129,140,248,0.12),transparent_70%)] pointer-events-none" />
            <span className="text-[11px] uppercase tracking-[0.9px] text-[#6b7488] font-semibold relative">Repository Health</span>
            <div className="flex items-center gap-[18px] relative">
              <div
                className="w-[116px] h-[116px] rounded-full flex-none relative grid place-items-center"
                style={{
                  background: `conic-gradient(${donutColor} calc(${health.score} * 1%), rgba(255,255,255,0.06) 0)`,
                }}
              >
                <div className="absolute inset-[9px] rounded-full bg-[#11141c] shadow-[0_0_0_1px_rgba(255,255,255,0.07)_inset]" />
                <div className="relative text-center leading-none">
                  <div className="text-[32px] font-bold tracking-[-1px] text-white">{health.score}</div>
                  <div className="text-[12px] text-[#6b7488] mt-[3px]">/ {health.max}</div>
                </div>
              </div>
              <div className="flex flex-col gap-[9px]">
                <div className="text-[13px] font-semibold text-[#e8ebf2]">
                  Grade <span className="font-mono text-[11px] px-[7px] py-[2px] rounded-[6px] ml-[4px]" style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24' }}>{health.grade}</span>
                </div>
                {healthTrend && (
                  <div className="inline-flex items-center gap-[5px] text-[12px] font-semibold" style={{ color: healthTrend.color }}>
                    <DeltaIcon dir={healthTrend.arrow} />
                    {healthTrend.text}
                  </div>
                )}
                {health.note && <div className="text-[11.5px] text-[#98a1b3] leading-[1.45]">{health.note}</div>}
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-4 gap-[12px]">
            {TILE_CONFIG.map(tile => {
              const metric = metrics[tile.key];
              const tv = trendPresentation(metric.trend);
              const valueText = metric.isPercent ? formatPercent(metric.value) : metric.value;
              return (
                <div
                  key={tile.key}
                  className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-[14px_15px_13px] relative overflow-hidden cursor-default transition-all hover:-translate-y-[2px] hover:border-[rgba(255,255,255,0.12)]"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[3px]" style={{ background: tile.color }} />
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-[#98a1b3] font-[550] flex items-center gap-[6px]">
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: tile.color }} />
                      {tile.label}
                    </span>
                  </div>
                  <div className="text-[27px] font-bold tracking-[-0.8px] mt-[8px] leading-none text-white">{valueText}</div>
                  {tv && (
                    <div className="text-[11px] font-semibold mt-[7px] inline-flex items-center gap-[4px]" style={{ color: tv.color }}>
                      <DeltaIcon dir={tv.arrow} />{tv.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_372px] gap-[24px] items-start">
          <div className="flex flex-col gap-[26px] min-w-0">
            {/* Test Case Explorer */}
            <section>
              <SectionHead title="Test Case Explorer" />
              <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)] overflow-hidden">
                <div className="p-[16px_18px_14px] border-b border-[rgba(255,255,255,0.07)] flex flex-col gap-[13px]">
                  <div className="flex items-center gap-[12px] flex-wrap">
                    <SearchInput placeholder="Search test cases, features, AI notes..." value={search} onChange={e => setSearch(e.target.value)} shortcut="/" type="search" />
                    <SegmentedControl
                      options={[{ label: 'Group by Type', value: 'Type' }, { label: 'By Feature', value: 'Feature' }, { label: 'By Status', value: 'Status' }]}
                      value={groupBy}
                      onChange={setGroupBy}
                    />
                  </div>
                  <div className="flex items-center gap-[8px] flex-wrap">
                    <span className="text-[11px] uppercase tracking-[0.6px] text-[#6b7488] font-semibold mr-[2px]">Filter</span>
                    <FilterSelect value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="All">All statuses</option>
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </FilterSelect>
                    <FilterSelect value={filterType} onChange={e => setFilterType(e.target.value)}>
                      <option value="All">All types</option>
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </FilterSelect>
                    <FilterSelect value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                      <option value="All">All risk</option>
                      <option value="High">High risk</option>
                      <option value="Medium">Medium risk</option>
                      <option value="Low">Low risk</option>
                    </FilterSelect>
                    <FilterSelect value={filterFeature} onChange={e => setFilterFeature(e.target.value)}>
                      <option value="All">All features</option>
                      {features.map(f => <option key={f} value={f}>{f}</option>)}
                    </FilterSelect>
                    {hasFilters && (
                      <button className="ml-auto text-[12px] text-[#818cf8] bg-none border-none cursor-pointer px-[8px] py-[6px] rounded-[6px] hover:bg-[rgba(129,140,248,0.14)]" onClick={clearFilters}>
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-[18px] py-[9px] text-[12px] text-[#6b7488] border-b border-[rgba(255,255,255,0.07)] flex items-center gap-[6px]">
                  Showing <b className="text-[#98a1b3]">&nbsp;{filtered.length}&nbsp;</b> of <b className="text-[#98a1b3]">&nbsp;{testCases.length}&nbsp;</b> test cases &middot; grouped by <b className="text-[#98a1b3]">&nbsp;{groupBy.toLowerCase()}</b>
                </div>
                <div className="max-h-[1100px] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="p-[60px_20px] text-center text-[#6b7488]">
                      <SearchIcon strokeWidth={1.8} className="w-[40px] h-[40px] opacity-30 mb-[12px] mx-auto" />
                      <div>No test cases match your filters.</div>
                    </div>
                  ) : (
                    Object.entries(grouped).map(([group, tests]) => (
                      <div key={group}>
                        <div className="sticky top-0 z-[2] flex items-center gap-[9px] px-[18px] py-[9px] bg-[#161a24] border-b border-[rgba(255,255,255,0.07)] text-[11.5px] font-[650] tracking-[0.3px] uppercase text-[#98a1b3]">
                          <span>{group}</span>
                          <span className="font-mono text-[11px] text-[#6b7488] bg-[#0d0f16] px-[8px] py-[1px] rounded-[99px] normal-case tracking-normal">{tests.length}</span>
                        </div>
                        {tests.map(tc => {
                          const isHighlighted = highlightedTests.has(tc.id);
                          const view = TEST_STATUS_VIEW[tc.status];
                          return (
                            <div
                              key={tc.id}
                              id={`tc-${tc.id}`}
                              className={`grid grid-cols-[auto_1fr_auto] gap-[13px] items-start px-[18px] py-[15px] border-b border-[rgba(255,255,255,0.07)] cursor-pointer transition-colors ${isHighlighted ? 'bg-[rgba(129,140,248,0.09)] shadow-[inset_3px_0_0_#818cf8]' : 'hover:bg-[rgba(255,255,255,0.022)]'}`}
                              onClick={() => toast(`${tc.id}: ${tc.title}`, 'success')}
                            >
                              <div className="w-[26px] h-[26px] rounded-[8px] grid place-items-center flex-none mt-[1px]" style={{ background: view.bg, color: view.color }}>
                                <TestStatusIcon status={tc.status} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13.8px] font-semibold text-[#e8ebf2] mb-[5px] tracking-[-0.1px]">{tc.title}</div>
                                <div className="flex items-center gap-[6px] flex-wrap mb-[7px]">
                                  <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] leading-[1.4] whitespace-nowrap capitalize" style={{ background: view.bg, color: view.color }}>
                                    <span className="w-[6px] h-[6px] rounded-full" style={{ background: view.color }} />
                                    {tc.status}
                                  </span>
                                  <span className="inline-flex items-center gap-[5px] text-[10.5px] font-mono px-[8px] py-[2.5px] rounded-[6px] leading-[1.4] whitespace-nowrap bg-[#1b2030] text-[#98a1b3] border border-[rgba(255,255,255,0.07)]">
                                    {tc.type}
                                  </span>
                                  <span className="inline-flex items-center gap-[5px] text-[11px] px-[8px] py-[2.5px] rounded-[6px] leading-[1.4] whitespace-nowrap bg-[#0d0f16] text-[#98a1b3] border border-[rgba(255,255,255,0.07)]">
                                    {tc.feature}
                                  </span>
                                  <span className="inline-flex items-center gap-[5px] text-[10.5px] font-mono uppercase tracking-[0.4px] px-[8px] py-[2.5px] rounded-[6px] leading-[1.4] whitespace-nowrap" style={{ color: RISK_COLOR[tc.risk], background: 'rgba(255,255,255,0.04)' }}>
                                    {tc.risk} risk
                                  </span>
                                </div>
                                <div className="text-[12.5px] text-[#98a1b3] leading-[1.5]">{tc.description}</div>
                                {tc.aiNote && (
                                  <div className={`flex items-start gap-[8px] mt-[9px] p-[8px_11px] rounded-[9px] text-[12px] leading-[1.45] ${tc.aiNote.tone === 'warn' ? 'bg-[rgba(251,191,36,0.07)] border border-[rgba(251,191,36,0.2)] text-[#f4dca0]' : 'bg-[rgba(129,140,248,0.07)] border border-[rgba(129,140,248,0.18)] text-[#c7cdf5]'}`}>
                                    {tc.aiNote.tone === 'warn' ? (
                                      <AlertCircleIcon className="w-[14px] h-[14px] flex-none mt-[1.5px] text-[#fbbf24]" />
                                    ) : (
                                      <LightbulbIcon className="w-[14px] h-[14px] flex-none mt-[1.5px] text-[#818cf8]" />
                                    )}
                                    <span>{tc.aiNote.text}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-[8px] flex-none">
                                <span className="text-[11px] text-[#6b7488] font-mono whitespace-nowrap">{formatRelativeTime(tc.lastRunAt)}</span>
                                <RunBars runs={tc.recentRuns} status={tc.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Testing Structure + Coverage & Risk */}
            <div className="grid grid-cols-2 gap-[24px] items-start">
              <section>
                <SectionHead title="Testing Structure" />
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)] overflow-hidden py-[8px_0]">
                  {structure.map(node => (
                    <div key={node.pathPrefix + node.name} className="px-[18px] py-[13px] border-b border-[rgba(255,255,255,0.07)] transition-colors hover:bg-[rgba(255,255,255,0.022)] cursor-pointer">
                      <div className="flex items-center gap-[10px] mb-[9px]">
                        <span className="font-mono text-[12.5px] text-[#e8ebf2]">
                          <span className="text-[#6b7488]">{node.pathPrefix}</span>{node.name}
                        </span>
                        <span className="ml-auto font-mono text-[12px] text-[#98a1b3]"><b className="text-[#e8ebf2]">{node.coverage}%</b> cov</span>
                      </div>
                      <div className="flex flex-wrap gap-[6px]">
                        {node.counts.map(c => (
                          <span key={c.label} className="inline-flex items-center gap-[5px] text-[11px] px-[8px] py-[2px] rounded-[6px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] text-[#98a1b3]">
                            <span className="w-[6px] h-[6px] rounded-full" style={{ background: STRUCTURE_KIND_COLOR[c.kind] ?? STRUCTURE_KIND_COLOR.other }} />{c.label}: {c.count}
                          </span>
                        ))}
                      </div>
                      <div className="h-[4px] rounded-[4px] bg-[rgba(255,255,255,0.06)] mt-[9px] overflow-hidden flex">
                        <span className="block h-full" style={{ width: `${node.coverage}%`, background: node.coverage >= 75 ? '#3ddc97' : node.coverage >= 55 ? '#fbbf24' : '#fb7185' }} />
                        <span className="block h-full" style={{ width: `${100 - node.coverage}%`, background: 'rgba(255,255,255,0.07)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <SectionHead title="Coverage & Risk" />
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)] p-[18px]">
                  <div className="mb-[18px]">
                    <div className="text-[12px] font-semibold text-[#98a1b3] mb-[12px] uppercase tracking-[0.5px]">Coverage by module</div>
                    {coverage.map(c => {
                      const color = c.line >= 75 ? '#3ddc97' : c.line >= 55 ? '#fbbf24' : '#fb7185';
                      return (
                        <div key={c.module} className="flex items-center gap-[12px] mb-[11px]">
                          <span className="text-[12.5px] w-[120px] flex-none text-[#e8ebf2]">
                            {c.module}
                            <span className="font-mono text-[11px] text-[#6b7488] block">line / branch</span>
                          </span>
                          <div className="flex-1 h-[8px] rounded-[99px] bg-[rgba(255,255,255,0.06)] overflow-hidden relative">
                            <span className="absolute left-0 top-0 bottom-0 rounded-[99px]" style={{ width: `${c.line}%`, background: color, opacity: 0.95, height: '4px' }} />
                            <span className="absolute left-0 top-[4px] bottom-0 rounded-[99px]" style={{ width: `${c.branch}%`, background: color, opacity: 0.55, height: '4px' }} />
                          </div>
                          <span className="font-mono text-[12.5px] font-semibold w-[42px] text-right flex-none" style={{ color }}>{c.line}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#98a1b3] mb-[12px] uppercase tracking-[0.5px]">Risk heatmap — failures &amp; gaps by module</div>
                    <table className="w-full border-separate border-spacing-[4px] text-[11px]">
                      <thead>
                        <tr className="text-[#6b7488]">
                          <th className="text-left py-[2px] px-[2px] font-semibold text-[10px] uppercase tracking-[0.4px]">Module</th>
                          {riskHeatmap.columns.map(col => <th key={col} className="text-left py-[2px] px-[2px] font-semibold text-[10px] uppercase tracking-[0.4px]">{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {riskHeatmap.rows.map(row => (
                          <tr key={row.module}>
                            <td className="py-[2px] px-[2px] font-mono text-[11px] text-[#98a1b3] normal-case tracking-normal">{row.module}</td>
                            {row.values.map((v, i) => (
                              <td key={i} className="py-[2px] px-[2px]">
                                <div className="h-[34px] rounded-[7px] grid place-items-center font-mono text-[12px] font-semibold text-white transition-transform hover:scale-110 relative z-[2]" style={{ background: HEAT_COLOR[v] }}>{v > 0 ? v : ''}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center gap-[7px] mt-[12px] text-[11px] text-[#6b7488] justify-end">
                      <span>no issues</span>
                      {HEAT_COLOR.map((c, i) => (
                        <span key={i} className="w-[13px] h-[13px] rounded-[4px]" style={{ background: c }} />
                      ))}
                      <span>more issues</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* AI Insights Sidebar */}
          <div className="flex flex-col gap-[22px] sticky top-[76px]">
            <section>
              <div className="flex items-baseline gap-[12px] mb-[14px] mt-[6px] mx-[2px]">
                <h2 className="text-[15px] font-[650] m-0 tracking-[-0.1px] text-white">AI Insights</h2>
                <span className="text-[12.5px] text-[#6b7488]">{insights.length} recommendations</span>
                <span className="flex-1 h-[1px] bg-[linear-gradient(90deg,rgba(255,255,255,0.07),transparent)]" />
              </div>
              <div className="flex flex-col gap-[11px] max-h-[calc(100vh-130px)] overflow-y-auto pr-[6px]">
                {insights.map(insight => {
                  const sev = SEVERITY_VIEW[insight.severity];
                  return (
                    <div
                      key={insight.id}
                      className={`shrink-0 bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[13px_14px] cursor-pointer transition-all relative overflow-hidden ${highlightedInsight === insight.id ? 'border-[rgba(129,140,248,0.35)] shadow-[0_0_0_1px_rgba(129,140,248,0.15),0_8px_24px_rgba(0,0,0,0.4)]' : 'hover:border-[rgba(255,255,255,0.12)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
                      onClick={() => handleInsightClick(insight)}
                    >
                      <div className="flex items-center gap-[9px] mb-[8px]">
                        <span className="text-[9.5px] font-bold tracking-[0.6px] uppercase px-[7px] py-[2.5px] rounded-[5px] flex-none" style={{ background: sev.bg, color: sev.color }}>{insight.severity}</span>
                        <span className="text-[13px] font-[650] tracking-[-0.1px] text-[#e8ebf2]">{insight.title}</span>
                      </div>
                      <div className="text-[12px] text-[#98a1b3] leading-[1.5] mb-[11px]">{insight.description}</div>
                      <button
                        className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-[#818cf8] bg-[rgba(129,140,248,0.14)] border border-[rgba(129,140,248,0.25)] px-[11px] py-[6px] rounded-[8px] cursor-pointer transition-all hover:bg-[rgba(129,140,248,0.22)]"
                        onClick={e => { e.stopPropagation(); goToGenerate(insight); }}
                      >
                        <ChevronRightIcon className="w-[13px] h-[13px]" />
                        {insight.action}
                      </button>
                      <div className="text-[11px] text-[#6b7488] mt-[8px] font-mono">{insight.meta ?? `${insight.relatedTestIds.length} related tests`}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
