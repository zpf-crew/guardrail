import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/components/ui/toast';
import { testCases, insights, modules, coverage, heatmap, heatmapCols, healthScore, statTiles } from '@/data/dashboardMockData';
import type { TestCase, Insight } from '@/data/dashboardMockData';

const statusBadgeVariant: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray'> = {
  pass: 'pass', fail: 'fail', flaky: 'flaky', missing: 'missing', suspect: 'suspect',
};

const riskBadgeVariant: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray'> = {
  low: 'pass', medium: 'flaky', high: 'fail',
};

const severityVariant: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray'> = {
  high: 'fail', medium: 'flaky', low: 'gray',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = React.useState('');
  const [groupBy, setGroupBy] = React.useState('Type');
  const [filterStatus, setFilterStatus] = React.useState('All');
  const [filterType, setFilterType] = React.useState('All');
  const [filterRisk, setFilterRisk] = React.useState('All');
  const [filterFeature, setFilterFeature] = React.useState('All');
  const [highlightedInsight, setHighlightedInsight] = React.useState<string | null>(null);
  const [highlightedTests, setHighlightedTests] = React.useState<Set<string>>(new Set());

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

  const features = [...new Set(testCases.map(tc => tc.feature))];
  const types = [...new Set(testCases.map(tc => tc.type))];
  const statuses = ['All', 'pass', 'fail', 'flaky', 'suspect'];

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
    setHighlightedInsight(insight.id);
    setHighlightedTests(new Set(insight.relatedTests));
    toast(`Highlighting ${insight.relatedTests.length} related tests`, 'success');
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('All');
    setFilterType('All');
    setFilterRisk('All');
    setFilterFeature('All');
    setHighlightedInsight(null);
    setHighlightedTests(new Set());
  };

  const hasFilters = search || filterStatus !== 'All' || filterType !== 'All' || filterRisk !== 'All' || filterFeature !== 'All';

  const circumference = 2 * Math.PI * 42;
  const scoreOffset = circumference - (healthScore.score / 100) * circumference;

  return (
    <div className="min-h-screen" style={{ fontFamily: 'var(--sans)' }}>
      <TopBar
        repo="checkout-service"
        branch="feature/coupon-refactor"
        scanTime="4 min ago · 2,418 files"
        actions={
          <>
            <Button variant="outline" onClick={() => toast('Scan started', 'loading')}>Run Scan</Button>
            <Button variant="primary" onClick={() => navigate('/tests')}>Generate Tests</Button>
          </>
        }
      />

      <div className="mx-auto max-w-[1320px] p-[26px]">
        <div className="grid grid-cols-[1fr_372px] gap-[22px]">
          <div className="flex flex-col gap-[22px]">
            {/* Health Summary */}
            <Panel className="p-[22px]">
              <div className="flex gap-[22px]">
                <div className="flex flex-col items-center justify-center min-w-[140px]">
                  <div className="relative w-[100px] h-[100px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#818cf8" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={scoreOffset} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[28px] font-bold text-white">{healthScore.score}</span>
                      <span className="text-[14px] font-semibold text-[#818cf8]">{healthScore.grade}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#3ddc97] mt-[6px]">{healthScore.trend}</div>
                  <div className="text-[11px] text-[#6b7488] mt-[2px]">{healthScore.note}</div>
                </div>
                <div className="flex-1 grid grid-cols-4 gap-[10px]">
                  {statTiles.map(tile => (
                    <Panel key={tile.label} className="p-[12px] text-center">
                      <div className="text-[18px] font-bold text-white">{tile.value}</div>
                      <div className="text-[11px] text-[#6b7488]">{tile.label}</div>
                    </Panel>
                  ))}
                </div>
              </div>
            </Panel>

            {/* Test Case Explorer */}
            <Panel className="p-[22px]">
              <div className="flex items-center gap-[12px] mb-[16px] flex-wrap">
                <SearchInput placeholder="Search tests..." value={search} onChange={e => setSearch(e.target.value)} shortcut="/" type="search" />
                <SegmentedControl
                  options={[{ label: 'Type', value: 'Type' }, { label: 'Feature', value: 'Feature' }, { label: 'Status', value: 'Status' }]}
                  value={groupBy}
                  onChange={setGroupBy}
                />
                <select className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-[10px] py-[7px] text-[12px] text-[#e8ebf2] outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-[10px] py-[7px] text-[12px] text-[#e8ebf2] outline-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="All">All Types</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-[10px] py-[7px] text-[12px] text-[#e8ebf2] outline-none" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                  <option value="All">All Risk</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-[10px] py-[7px] text-[12px] text-[#e8ebf2] outline-none" value={filterFeature} onChange={e => setFilterFeature(e.target.value)}>
                  <option value="All">All Features</option>
                  {features.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {hasFilters && <Button variant="ghost" size="default" onClick={clearFilters}>Clear</Button>}
              </div>

              <div className="text-[11px] text-[#6b7488] mb-[10px]">{filtered.length} tests found</div>

              {Object.entries(grouped).map(([group, tests]) => (
                <div key={group} className="mb-[16px]">
                  <div className="text-[12px] font-semibold text-[#98a1b3] mb-[8px] flex items-center gap-[6px]">
                    {group} <span className="text-[#6b7488] font-normal">({tests.length})</span>
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    {tests.map(tc => {
                      const isHighlighted = highlightedTests.has(tc.id);
                      return (
                        <Panel
                          key={tc.id}
                          className={`p-[14px] cursor-pointer transition-all ${isHighlighted ? 'border-[rgba(129,140,248,0.35)] shadow-[0_0_0_1px_rgba(129,140,248,0.15)]' : ''}`}
                          onClick={() => toast(`${tc.id}: ${tc.title}`, 'success')}
                        >
                          <div className="flex items-start gap-[10px]">
                            <span className={`mt-[2px] ${tc.status === 'pass' ? 'text-[#3ddc97]' : tc.status === 'fail' ? 'text-[#fb7185]' : tc.status === 'flaky' ? 'text-[#fbbf24]' : 'text-[#c084fc]'}`}>
                              {tc.status === 'pass' ? '●' : tc.status === 'fail' ? '✕' : tc.status === 'flaky' ? '⚡' : '⚠'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-[#e8ebf2]">{tc.title}</div>
                              <div className="flex flex-wrap gap-[5px] mt-[4px]">
                                <Badge variant={statusBadgeVariant[tc.status]} dot>{tc.status}</Badge>
                                <Badge variant="gray">{tc.type}</Badge>
                                <Badge variant="accent">{tc.feature}</Badge>
                                <Badge variant={riskBadgeVariant[tc.risk]}>{tc.risk}</Badge>
                              </div>
                              <div className="text-[12px] text-[#6b7488] mt-[4px]">{tc.description}</div>
                              {tc.aiNote && <div className="text-[11px] text-[#818cf8] mt-[3px]">🤖 {tc.aiNote}</div>}
                              <div className="flex items-center gap-[12px] mt-[6px] text-[11px] text-[#6b7488]">
                                <span>{tc.duration}</span>
                                <span>Last run: {tc.lastRun}</span>
                              </div>
                            </div>
                          </div>
                        </Panel>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Panel>

            {/* Testing Structure */}
            <Panel className="p-[22px]">
              <div className="text-[14px] font-semibold text-white mb-[14px]">Testing Structure</div>
              <div className="flex flex-col gap-[10px]">
                {modules.map(m => (
                  <div key={m.path} className="flex items-center gap-[12px]">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[#e8ebf2]">{m.name}</div>
                      <div className="text-[11px] text-[#6b7488] font-mono">{m.path}</div>
                    </div>
                    <div className="text-[12px] text-[#98a1b3] w-[40px] text-right">{m.coverage}%</div>
                    <div className="w-[120px]">
                      <ProgressBar value={m.coverage} />
                    </div>
                    <div className="flex gap-[4px]">
                      <Badge variant="gray">U:{m.tests.unit}</Badge>
                      <Badge variant="gray">I:{m.tests.integration}</Badge>
                      <Badge variant="gray">E:{m.tests.e2e}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Coverage & Risk */}
            <Panel className="p-[22px]">
              <div className="text-[14px] font-semibold text-white mb-[14px]">Coverage & Risk</div>
              <div className="grid grid-cols-2 gap-[16px]">
                <div>
                  <div className="text-[12px] text-[#98a1b3] mb-[10px] font-semibold">Coverage by Module</div>
                  {coverage.map(c => (
                    <div key={c.name} className="mb-[8px]">
                      <div className="flex justify-between text-[11px] mb-[3px]">
                        <span className="text-[#e8ebf2]">{c.name}</span>
                        <span className="text-[#6b7488]">L:{c.line}% B:{c.branch}%</span>
                      </div>
                      <div className="h-[6px] rounded-[99px] bg-[#0d0f16] overflow-hidden">
                        <div className="h-full rounded-[99px] bg-gradient-to-r from-[#5d68f0] to-[#22d3ee]" style={{ width: `${c.line}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[12px] text-[#98a1b3] mb-[10px] font-semibold">Risk Heatmap</div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[#6b7488]">
                        {heatmapCols.map(col => <th key={col} className="text-left py-[4px] px-[6px] font-semibold">{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.map(row => (
                        <tr key={row.module} className="text-[#e8ebf2]">
                          <td className="py-[4px] px-[6px]">{row.module}</td>
                          <td className="py-[4px] px-[6px] text-center">
                            {row.missing > 0 ? <Badge variant="missing">{row.missing}</Badge> : <span className="text-[#6b7488]">—</span>}
                          </td>
                          <td className="py-[4px] px-[6px] text-center">
                            {row.suspicious > 0 ? <Badge variant="suspect">{row.suspicious}</Badge> : <span className="text-[#6b7488]">—</span>}
                          </td>
                          <td className="py-[4px] px-[6px] text-center">
                            {row.flaky > 0 ? <Badge variant="flaky">{row.flaky}</Badge> : <span className="text-[#6b7488]">—</span>}
                          </td>
                          <td className="py-[4px] px-[6px] text-center">
                            {row.failed > 0 ? <Badge variant="fail">{row.failed}</Badge> : <span className="text-[#6b7488]">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          </div>

          {/* AI Insights Sidebar */}
          <div className="flex flex-col gap-[14px]">
            <div className="text-[14px] font-semibold text-white">AI Insights</div>
            {insights.map(insight => (
              <Panel
                key={insight.id}
                className={`p-[16px] cursor-pointer transition-all ${highlightedInsight === insight.id ? 'border-[rgba(129,140,248,0.35)] shadow-[0_0_0_1px_rgba(129,140,248,0.15)]' : ''}`}
                onClick={() => handleInsightClick(insight)}
              >
                <div className="flex items-center gap-[6px] mb-[6px]">
                  <Badge variant={severityVariant[insight.severity]} dot>{insight.severity}</Badge>
                </div>
                <div className="text-[13px] font-semibold text-[#e8ebf2] mb-[4px]">{insight.title}</div>
                <div className="text-[12px] text-[#98a1b3] leading-[1.5] mb-[10px]">{insight.description}</div>
                <Button variant="outline" size="default" className="w-full text-[12px]">{insight.action}</Button>
                <div className="text-[10px] text-[#6b7488] mt-[6px]">{insight.relatedTests.length} related tests</div>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
