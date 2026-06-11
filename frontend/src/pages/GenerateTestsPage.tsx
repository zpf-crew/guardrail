import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeDiff } from '@/components/ui/code-diff';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/components/ui/toast';
import { quickActions, classification, planActions, planRisk, planFiles, aiQuestions, genTimeline, changes, covCompare, matrix, reviewStats, reviewFiles } from '@/data/generateTestsMockData';

const workflowSteps = [
  { title: 'Intent' },
  { title: 'Isolation' },
  { title: 'Plan' },
  { title: 'Generate' },
  { title: 'Run' },
  { title: 'Review' },
];

const testTypeOptions = ['Unit', 'UI/Browser', 'Mobile'];

const statusColor: Record<string, string> = { pass: 'text-[#3ddc97]', fail: 'text-[#fb7185]', running: 'text-[#818cf8]' };
const changeTypeBadge: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent'> = { add: 'pass', update: 'flaky', delete: 'fail' };
const riskBadge: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent'> = { low: 'pass', medium: 'flaky', high: 'fail' };
const classStatusBadge: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent'> = { covered: 'pass', missing: 'missing', weak: 'flaky', suspicious: 'suspect' };

export function GenerateTestsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [prompt, setPrompt] = React.useState('');
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>(['Unit']);
  const [selectedFeature, setSelectedFeature] = React.useState('Coupon');
  const [expandedChanges, setExpandedChanges] = React.useState<Set<string>>(new Set());
  const [changeFilter, setChangeFilter] = React.useState('All');
  const [answeredQuestions, setAnsweredQuestions] = React.useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [runProgress, setRunProgress] = React.useState(0);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleQuickAction = (title: string) => {
    const actionMap: Record<string, string> = {
      'Generate missing coupon tests': 'Generate 4 missing coupon edge-case tests for validation',
      'Fix suspicious payment tests': 'Fix 2 suspicious payment tests that conflict with product specs',
      'Fix flaky payment decline test': 'Fix T-006 flaky payment decline test with timing issue',
      'Add UI tests for checkout timeout': 'Add UI test for checkout timeout behavior that actually triggers timeout',
      'Update mobile test devices': 'Update mobile tests to include iPhone 15 and Pixel 7',
    };
    setPrompt(actionMap[title] || title);
    toast('Prompt filled', 'success');
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    toast('Analyzing...', 'loading');
    setTimeout(() => {
      setAnalyzing(false);
      setCurrentStep(1);
      toast('Analysis complete', 'success');
    }, 1500);
  };

  const handleGeneratePlan = () => {
    setGenerating(true);
    toast('Generating test plan...', 'loading');
    setTimeout(() => {
      setGenerating(false);
      setCurrentStep(2);
      toast('Plan ready', 'success');
    }, 2000);
  };

  const handleApprovePlan = () => {
    setCurrentStep(3);
    toast('Plan approved', 'success');
  };

  const handleRunTests = () => {
    setRunProgress(0);
    toast('Running tests...', 'loading');
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setRunProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setCurrentStep(5);
        toast('Tests complete', 'success');
      }
    }, 200);
  };

  const handleApplyChanges = () => {
    toast('Changes applied', 'success');
  };

  const handleCreatePR = () => {
    toast('PR created', 'success');
  };

  const toggleChange = (id: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredChanges = changeFilter === 'All' ? changes : changes.filter(c => {
    if (['add', 'update', 'delete'].includes(changeFilter)) return c.changeType === changeFilter;
    if (changeFilter === 'UI/Browser') return c.testType === 'ui';
    if (changeFilter === 'Mobile') return c.testType === 'mobile';
    return c.testType === 'unit';
  });

  return (
    <div className="min-h-screen" style={{ fontFamily: 'var(--sans)' }}>
      <div className="flex">
        {/* Workflow Sidebar */}
        <Panel className="w-[218px] min-h-screen p-[18px] flex-shrink-0">
          <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Workflow</div>
          <div className="flex flex-col gap-[2px] mb-[16px]">
            {workflowSteps.map((step, i) => (
              <div
                key={step.title}
                className={`flex items-center gap-[8px] p-[9px_10px] rounded-[9px] cursor-pointer text-[13px] transition-colors ${i === currentStep ? 'bg-[rgba(129,140,248,0.14)] text-white' : i < currentStep ? 'text-[#3ddc97] hover:bg-[rgba(255,255,255,0.025)]' : 'text-[#6b7488] hover:bg-[rgba(255,255,255,0.025)]'}`}
                onClick={() => { if (i <= currentStep) setCurrentStep(i); }}
              >
                <span className={`w-[22px] h-[22px] rounded-full grid place-items-center text-[11px] font-mono font-semibold ${i < currentStep ? 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]' : i === currentStep ? 'border border-[#818cf8] text-[#818cf8]' : 'border border-[rgba(255,255,255,0.12)] text-[#6b7488]'}`}>
                  {i < currentStep ? '✓' : i + 1}
                </span>
                {step.title}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-[#6b7488] leading-[1.4] border-t border-[rgba(255,255,255,0.07)] pt-[12px]">
            Production code changes require approval.
          </div>
        </Panel>

        {/* Main Content */}
        <div className="flex-1 p-[26px] max-w-[900px]">
          {/* Step 1: Intent */}
          {currentStep === 0 && (
            <Panel className="p-[26px]">
              <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 1 — Intent</div>
              <h3 className="text-[18px] font-semibold text-white mb-[4px]">What testing do you want to improve?</h3>
              <p className="text-[13.5px] text-[#98a1b3] mb-[18px]">Describe what you want to test, and Guardrail will find the right approach.</p>

              <textarea
                className="w-full h-[100px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[14px] text-[#e8ebf2] text-[13.5px] outline-none resize-none focus:border-[rgba(129,140,248,0.35)] mb-[14px]"
                placeholder="e.g., Add missing edge-case tests for coupon validation..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />

              <div className="flex gap-[10px] mb-[14px] items-center">
                <label className="text-[12.5px] text-[#98a1b3]">Feature:</label>
                <select className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-[10px] py-[7px] text-[12px] text-[#e8ebf2] outline-none" value={selectedFeature} onChange={e => setSelectedFeature(e.target.value)}>
                  <option>Coupon</option>
                  <option>Payment</option>
                  <option>Checkout</option>
                </select>
              </div>

              <div className="mb-[18px]">
                <label className="text-[12.5px] text-[#98a1b3] mb-[6px] block">Test Types</label>
                <div className="flex gap-[6px]">
                  {testTypeOptions.map(type => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`px-[12px] py-[6px] rounded-[8px] text-[12.5px] font-medium cursor-pointer transition-all border ${selectedTypes.includes(type) ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.25)] text-white' : 'bg-transparent border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-[18px]">
                <label className="text-[12.5px] text-[#98a1b3] mb-[8px] block">Quick Actions</label>
                <div className="grid grid-cols-2 gap-[8px]">
                  {quickActions.map(action => (
                    <Panel key={action.title} className="p-[12px] cursor-pointer hover:border-[rgba(129,140,248,0.25)] transition-colors" onClick={() => handleQuickAction(action.title)}>
                      <div className="text-[16px] mb-[4px]">{action.icon}</div>
                      <div className="text-[12.5px] font-medium text-[#e8ebf2]">{action.title}</div>
                      <div className="text-[11px] text-[#6b7488] mt-[2px]">{action.description}</div>
                    </Panel>
                  ))}
                </div>
              </div>

              <div className="flex gap-[10px]">
                <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
                <Button variant="primary" size="lg" onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing ? 'Analyzing...' : 'Analyze'}
                </Button>
              </div>
            </Panel>
          )}

          {/* Step 2: Isolation */}
          {currentStep === 1 && (
            <Panel className="p-[26px]">
              <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 2 — Isolation & Classification</div>
              <h3 className="text-[18px] font-semibold text-white mb-[14px]">Source & Context</h3>

              <div className="grid grid-cols-2 gap-[14px] mb-[18px]">
                <div>
                  <div className="text-[12px] text-[#98a1b3] mb-[6px] font-semibold">Source Files</div>
                  {['src/services/coupon/coupon.ts', 'src/services/coupon/coupon.test.ts', 'src/routes/checkout/checkout.e2e.ts', 'tests/mobile/checkout.mobile.ts'].map(f => (
                    <div key={f} className="text-[12px] font-mono text-[#e8ebf2] bg-[#0d0f16] rounded-[6px] px-[10px] py-[6px] mb-[4px]">{f}</div>
                  ))}
                </div>
                <div>
                  <div className="text-[12px] text-[#98a1b3] mb-[6px] font-semibold">Specs & QC Cases</div>
                  {['Checkout Flow Spec.pdf', 'Coupon Rules.md', 'qc-checkout-suite.csv', 'qc-payment-cases.xlsx'].map(f => (
                    <div key={f} className="text-[12px] text-[#e8ebf2] bg-[#0d0f16] rounded-[6px] px-[10px] py-[6px] mb-[4px]">{f}</div>
                  ))}
                </div>
              </div>

              <div className="flex gap-[10px] mb-[18px]">
                <Badge variant="gray">Line: 64%</Badge>
                <Badge variant="gray">Branch: 52%</Badge>
                <Badge variant="fail">1 failed</Badge>
                <Badge variant="suspect">1 suspicious</Badge>
                <Badge variant="missing">4 missing</Badge>
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[10px]">
                Detected user journeys: coupon application, payment processing, checkout flow
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[10px] font-semibold">Behavior Classification</div>
              <div className="grid grid-cols-2 gap-[8px] mb-[18px]">
                {classification.map(c => (
                  <Panel key={c.behavior} className="p-[12px]">
                    <div className="flex items-center gap-[6px] mb-[4px]">
                      <Badge variant={classStatusBadge[c.status]} dot>{c.status}</Badge>
                      <Badge variant="gray">{c.type}</Badge>
                      <Badge variant={riskBadge[c.risk]}>{c.risk}</Badge>
                    </div>
                    <div className="text-[12.5px] font-medium text-[#e8ebf2]">{c.behavior}</div>
                    <div className="text-[11px] text-[#6b7488] mt-[2px]">{c.explanation}</div>
                  </Panel>
                ))}
              </div>

              <div className="flex gap-[10px]">
                <Button variant="ghost" onClick={() => setCurrentStep(0)}>Back</Button>
                <Button variant="primary" size="lg" onClick={handleGeneratePlan} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate Test Plan'}
                </Button>
              </div>
            </Panel>
          )}

          {/* Step 3: Plan */}
          {currentStep === 2 && (
            <Panel className="p-[26px]">
              <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 3 — Confirmation & Plan</div>
              <h3 className="text-[18px] font-semibold text-white mb-[14px]">Proposed Actions</h3>

              <div className="grid grid-cols-2 gap-[8px] mb-[18px]">
                {planActions.map(a => (
                  <div key={a.action} className="flex items-center gap-[8px] bg-[#0d0f16] rounded-[8px] px-[12px] py-[10px]">
                    <span className="text-[#818cf8] font-semibold">{a.count}</span>
                    <span className="text-[12.5px] text-[#e8ebf2]">{a.action}</span>
                  </div>
                ))}
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Risk Assessment</div>
              <div className="flex flex-col gap-[6px] mb-[18px]">
                {planRisk.map(r => (
                  <div key={r.item} className="flex items-center justify-between bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                    <span className="text-[12px] text-[#e8ebf2]">{r.item}</span>
                    <Badge variant={riskBadge[r.level]}>{r.level}</Badge>
                  </div>
                ))}
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Files Likely to Change</div>
              <div className="flex flex-col gap-[4px] mb-[18px]">
                {planFiles.map(f => (
                  <div key={f} className="text-[12px] font-mono text-[#818cf8] bg-[#0d0f16] rounded-[6px] px-[10px] py-[5px]">{f}</div>
                ))}
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">AI Questions</div>
              <div className="flex flex-col gap-[12px] mb-[18px]">
                {aiQuestions.map((q, qi) => (
                  <Panel key={qi} className="p-[14px]">
                    <div className="text-[13px] font-medium text-[#e8ebf2] mb-[8px]">{q.question}</div>
                    <div className="flex flex-wrap gap-[6px]">
                      {q.options.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setAnsweredQuestions(prev => ({ ...prev, [qi]: opt }))}
                          className={`px-[10px] py-[5px] rounded-[7px] text-[12px] cursor-pointer transition-all border ${answeredQuestions[qi] === opt ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.25)] text-white' : 'bg-transparent border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </Panel>
                ))}
              </div>

              <div className="flex gap-[10px] flex-wrap">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>Back</Button>
                <Button variant="outline">Edit Plan</Button>
                <Button variant="outline">Skip UI Tests</Button>
                <Button variant="outline">Unit Tests Only</Button>
                <div className="flex-1" />
                <Button variant="danger">Cancel</Button>
                <Button variant="primary" size="lg" onClick={handleApprovePlan}>Approve Plan</Button>
              </div>
            </Panel>
          )}

          {/* Step 4: Generate */}
          {currentStep === 3 && (
            <Panel className="p-[26px]">
              <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 4 — Generate Changes</div>
              <h3 className="text-[18px] font-semibold text-white mb-[14px]">Agent Activity</h3>

              <div className="flex flex-col gap-[4px] mb-[18px]">
                {genTimeline.map((t, i) => (
                  <div key={i} className={`flex items-center gap-[8px] text-[12.5px] ${t.state === 'done' ? 'text-[#3ddc97]' : 'text-[#6b7488]'}`}>
                    {t.state === 'done' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[13px] h-[13px]"><path d="M5 12l4 4 10-10" /></svg>
                    ) : (
                      <span className="w-[13px] h-[13px] rounded-full border border-[rgba(255,255,255,0.12)]" />
                    )}
                    {t.label}
                  </div>
                ))}
              </div>

              <div className="flex gap-[6px] mb-[14px] flex-wrap">
                {['All', 'add', 'update', 'delete', 'Unit', 'UI/Browser', 'Mobile'].map(f => (
                  <button
                    key={f}
                    onClick={() => setChangeFilter(f)}
                    className={`px-[10px] py-[5px] rounded-[6px] text-[11.5px] cursor-pointer transition-all border ${changeFilter === f ? 'bg-[#1b2030] text-white' : 'bg-transparent border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-[10px] mb-[18px]">
                {filteredChanges.map(change => (
                  <Panel key={change.id} className="p-[14px]">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleChange(change.id)}>
                      <div>
                        <div className="text-[13px] font-medium text-[#e8ebf2]">{change.title}</div>
                        <div className="flex gap-[5px] mt-[4px]">
                          <Badge variant={changeTypeBadge[change.changeType]}>{change.changeType}</Badge>
                          <Badge variant="gray">{change.testType}</Badge>
                          <Badge variant="accent">{change.feature}</Badge>
                          <Badge variant={riskBadge[change.risk]}>{change.risk}</Badge>
                        </div>
                      </div>
                      <span className="text-[#6b7488] text-[11px]">{expandedChanges.has(change.id) ? '▲' : '▼'}</span>
                    </div>
                    {expandedChanges.has(change.id) && (
                      <div className="mt-[10px]">
                        <div className="text-[11px] text-[#98a1b3] mb-[6px]">{change.reason}</div>
                        <CodeDiff diff={change.diff} />
                      </div>
                    )}
                  </Panel>
                ))}
              </div>

              <div className="flex gap-[10px]">
                <Button variant="ghost" onClick={() => setCurrentStep(2)}>Back</Button>
                <Button variant="primary" size="lg" onClick={handleRunTests}>Run Tests</Button>
              </div>
            </Panel>
          )}

          {/* Step 5: Run */}
          {currentStep === 4 && (
            <Panel className="p-[26px]">
              <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 5 — Run Tests</div>
              <h3 className="text-[18px] font-semibold text-white mb-[14px]">Running tests...</h3>

              <div className="mb-[18px]">
                <ProgressBar value={runProgress} />
                <div className="text-[11px] text-[#6b7488] mt-[6px]">{runProgress}% complete</div>
              </div>

              <div className="grid grid-cols-3 gap-[12px] mb-[18px]">
                <Panel className="p-[14px] text-center">
                  <div className="text-[11px] text-[#6b7488] mb-[2px]">Unit Tests</div>
                  <div className="text-[20px] font-bold text-[#3ddc97]">6/6</div>
                  <div className="text-[11px] text-[#6b7488]">1.2s</div>
                </Panel>
                <Panel className="p-[14px] text-center">
                  <div className="text-[11px] text-[#6b7488] mb-[2px]">UI/Browser</div>
                  <div className="text-[20px] font-bold text-[#3ddc97]">3/3</div>
                  <div className="text-[11px] text-[#6b7488]">8.4s</div>
                </Panel>
                <Panel className="p-[14px] text-center">
                  <div className="text-[11px] text-[#6b7488] mb-[2px]">Mobile</div>
                  <div className="text-[20px] font-bold text-[#fb7185]">1/2</div>
                  <div className="text-[11px] text-[#6b7488]">12.8s</div>
                </Panel>
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Coverage Comparison</div>
              <div className="grid grid-cols-2 gap-[10px] mb-[18px]">
                {covCompare.map(c => (
                  <div key={c.metric} className="bg-[#0d0f16] rounded-[8px] p-[12px]">
                    <div className="text-[11px] text-[#98a1b3] mb-[4px]">{c.metric}</div>
                    <div className="flex items-center gap-[8px]">
                      <span className="text-[16px] font-bold text-[#6b7488]">{c.before}%</span>
                      <span className="text-[#6b7488]">→</span>
                      <span className="text-[16px] font-bold text-[#3ddc97]">{c.after}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Test Results</div>
              <div className="flex flex-col gap-[6px] mb-[18px]">
                {matrix.map(row => (
                  <div key={row.name} className="flex items-center gap-[10px] bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                    <span className={statusColor[row.status]}>{row.status === 'pass' ? '●' : row.status === 'fail' ? '✕' : '⟳'}</span>
                    <span className="text-[12px] text-[#e8ebf2] flex-1">{row.name}</span>
                    <Badge variant="gray">{row.type}</Badge>
                    <span className="text-[11px] text-[#6b7488]">{row.duration}</span>
                    {row.evidence && <Badge variant="accent">{row.evidence}</Badge>}
                    <span className="text-[11px] font-mono text-[#98a1b3]">{row.file}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-[10px]">
                <Button variant="ghost" onClick={() => setCurrentStep(3)}>Back</Button>
                <Button variant="primary" size="lg" onClick={() => setCurrentStep(5)}>Review & Apply</Button>
              </div>
            </Panel>
          )}

          {/* Step 6: Review */}
          {currentStep === 5 && (
            <Panel className="p-[26px]">
              <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 6 — Review & Apply</div>

              <Panel className="p-[16px] mb-[18px] bg-[rgba(61,220,151,0.08)] border-[rgba(61,220,151,0.2)]">
                <div className="text-[13px] font-semibold text-[#3ddc97] mb-[2px]">Recommended: Apply changes</div>
                <div className="text-[12px] text-[#98a1b3]">10 of 11 tests pass. Coverage improved from 64% to 78%. 1 mobile test fails on iPhone 15.</div>
              </Panel>

              <div className="grid grid-cols-4 gap-[10px] mb-[18px]">
                {reviewStats.map(s => (
                  <Panel key={s.label} className="p-[12px] text-center">
                    <div className="text-[16px] font-bold text-white">{s.value}</div>
                    <div className="text-[11px] text-[#6b7488]">{s.label}</div>
                  </Panel>
                ))}
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Files Changed</div>
              <div className="flex flex-col gap-[6px] mb-[18px]">
                {reviewFiles.map(f => (
                  <div key={f.path} className="flex items-center gap-[10px] bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                    <span className="text-[12px] font-mono text-[#e8ebf2] flex-1">{f.path}</span>
                    <span className="text-[11px] text-[#3ddc97]">+{f.additions}</span>
                    <span className="text-[11px] text-[#fb7185]">-{f.deletions}</span>
                  </div>
                ))}
              </div>

              <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Remaining Risk</div>
              <div className="flex flex-col gap-[6px] mb-[18px]">
                {[
                  { item: 'Pixel 7 retry timing', level: 'medium' as const },
                  { item: 'Production code changes', level: 'medium' as const },
                  { item: 'Open questions not answered', level: 'low' as const },
                  { item: 'Visual baselines need update', level: 'low' as const },
                ].map(r => (
                  <div key={r.item} className="flex items-center justify-between bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                    <span className="text-[12px] text-[#e8ebf2]">{r.item}</span>
                    <Badge variant={riskBadge[r.level]}>{r.level}</Badge>
                  </div>
                ))}
              </div>

              <div className="flex gap-[10px] flex-wrap">
                <Button variant="ghost" onClick={() => setCurrentStep(4)}>Back</Button>
                <Button variant="danger">Revert All</Button>
                <Button variant="outline">Export Test Plan</Button>
                <Button variant="outline" onClick={handleCreatePR}>Create PR</Button>
                <div className="flex-1" />
                <Button variant="primary" size="lg" onClick={handleApplyChanges}>Apply Changes</Button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
