import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeDiff } from '@/components/ui/code-diff';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/components/ui/toast';
import { quickActions, classification, planActions, planRisk, planFiles, aiQuestions, genTimeline, changes, covCompare, matrix, reviewStats, reviewFiles } from '@/data/generateTestsMockData';

const workflowSteps = [
  { title: 'Intent', status: 'Ready' },
  { title: 'Isolation', status: 'Done' },
  { title: 'Plan', status: 'Done' },
  { title: 'Generate', status: 'Done' },
  { title: 'Run', status: 'Done' },
  { title: 'Review', status: 'Pending' },
];

const testTypeOptions = ['Unit', 'UI/Browser', 'Mobile'];

const riskBadge: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent'> = { low: 'pass', medium: 'flaky', high: 'fail' };
const classStatusBadge: Record<string, 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent'> = { covered: 'pass', missing: 'missing', weak: 'flaky', suspicious: 'suspect' };

const riskColor: Record<string, string> = { low: '#3ddc97', medium: '#fbbf24', high: '#fb7185' };
const classBorderColor: Record<string, string> = { covered: '#3ddc97', missing: '#60a5fa', weak: '#fbbf24', suspicious: '#c084fc', failed: '#fb7185' };

function StepHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-[20px]">
      <div className="text-[11px] font-bold tracking-[0.9px] text-[#818cf8] uppercase mb-[8px]">{eyebrow}</div>
      <h1 className="text-[23px] font-semibold text-white tracking-[-0.4px] mb-[7px] leading-[1.3]">{title}</h1>
      {description && <p className="text-[14px] text-[#98a1b3] max-w-[720px] leading-[1.55]">{description}</p>}
    </div>
  );
}

function BlockHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-[9px] text-[12px] font-semibold uppercase tracking-[0.6px] text-[#98a1b3] mb-[13px]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] text-[#818cf8]">
        <path d="M4 6h16M4 12h16M4 18h10"/>
      </svg>
      {label}
      {count !== undefined && <span className="font-mono text-[11px] text-[#6b7488] bg-[#0d0f16] px-[8px] py-[1px] rounded-full">{count}</span>}
    </div>
  );
}

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'running' }) {
  if (status === 'pass') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] text-[#3ddc97]">
        <path d="M5 12l4 4 10-10"/>
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] text-[#fb7185]">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] text-[#818cf8]">
      <path d="M12 2v20M2 12h20"/>
    </svg>
  );
}

function FileIcon({ type }: { type: 'code' | 'doc' }) {
  if (type === 'doc') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] text-[#fbbf24]">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] text-[#818cf8]">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

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

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
    timerRef.current = setTimeout(() => {
      setAnalyzing(false);
      setCurrentStep(1);
      toast('Analysis complete', 'success');
    }, 1500);
  };

  const handleGeneratePlan = () => {
    setGenerating(true);
    toast('Generating test plan...', 'loading');
    timerRef.current = setTimeout(() => {
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
    intervalRef.current = setInterval(() => {
      progress += 5;
      setRunProgress(progress);
      if (progress >= 100) {
        const id = intervalRef.current;
        if (id) clearInterval(id);
        intervalRef.current = null;
        setCurrentStep(4);
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
      <TopBar
        repo="checkout-service"
        branch="feature/coupon-refactor"
        contentClassName="mx-auto max-w-[1118px]"
        actions={
          <>
            <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(129,140,248,0.25)] px-[11px] py-[6px] rounded-[8px] text-[12.5px] text-[#818cf8] font-medium">
              <span className="w-[6px] h-[6px] rounded-full bg-[#818cf8] animate-pulse" />
              {workflowSteps[currentStep].title}
            </span>
            <Button variant="ghost" onClick={() => toast('Workflow saved as draft', 'success')}>Save draft</Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] mr-[6px]">
                <path d="M19 12H5M11 6l-6 6 6 6"/>
              </svg>
              Back to Dashboard
            </Button>
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-[1118px]">
        {/* Workflow Sidebar */}
        <div className="w-[218px] min-h-screen border-r border-[rgba(255,255,255,0.07)] p-[22px_16px] flex-shrink-0">
          <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[16px] mx-[6px]">Workflow</div>
          <div className="flex flex-col mb-[16px] relative">
            {workflowSteps.map((step, i) => (
              <div
                key={step.title}
                className={`relative flex gap-[12px] p-[10px_11px] rounded-[11px] cursor-pointer text-[13px] transition-all border border-transparent mb-[2px] ${
                  i === currentStep ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.25)] shadow-[0_0_0_1px_rgba(129,140,248,0.12)]' : 
                  i < currentStep ? 'text-[#3ddc97] hover:bg-[rgba(255,255,255,0.025)]' : 
                  'text-[#6b7488] hover:bg-[rgba(255,255,255,0.025)]'
                }`}
                onClick={() => { if (i <= currentStep) setCurrentStep(i); }}
              >
                <span className={`w-[26px] h-[26px] rounded-full flex-shrink-0 grid place-items-center text-[12px] font-mono font-semibold transition-all relative ${
                  i < currentStep ? 'bg-[rgba(61,220,151,0.13)] border-[rgba(61,220,151,0.5)] text-[#3ddc97]' : 
                  i === currentStep ? 'border-[1.5px] border-[#818cf8] text-[#818cf8] bg-[#11141c]' : 
                  'border-[1.5px] border-[rgba(255,255,255,0.12)] text-[#6b7488] bg-[#0d0f16]'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </span>
                <div className="pt-[3px]">
                  <div className={`text-[13.5px] font-semibold ${i === currentStep ? 'text-white' : 'text-[#e8ebf2]'}`}>{step.title}</div>
                  <div className={`text-[11px] mt-[1px] ${
                    i < currentStep ? 'text-[#3ddc97]' : i === currentStep ? 'text-[#818cf8]' : 'text-[#6b7488]'
                  }`}>
                    {i < currentStep ? 'Done' : i === currentStep ? 'Active' : step.status}
                  </div>
                </div>
                {/* Connector line */}
                {i < workflowSteps.length - 1 && (
                  <div className="absolute left-[23.5px] top-[38px] w-[1.5px] h-[calc(100%-24px)] bg-[rgba(255,255,255,0.12)]" />
                )}
                {i < currentStep && i < workflowSteps.length - 1 && (
                  <div className="absolute left-[23.5px] top-[38px] w-[1.5px] h-[calc(100%-24px)] bg-[rgba(61,220,151,0.4)]" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-[22px] p-[12px] bg-[rgba(34,211,238,0.05)] border border-[rgba(34,211,238,0.18)] rounded-[11px] text-[11px] text-[#98a1b3] leading-[1.5]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] text-[#22d3ee] mb-[6px]">
              <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/>
            </svg>
            <b className="text-[#e8ebf2]">Production code changes require approval.</b> Test file changes are fully reviewable before apply.
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full max-w-[900px] p-[26px_28px_70px] min-w-0">
          {/* Step 1: Intent */}
          {currentStep === 0 && (
            <div>
              <StepHeader 
                eyebrow="Step 1 — Intent" 
                title="What testing do you want to improve?"
                description="Describe a goal in plain language. Guardrail first isolates behavior, classifies risk, and confirms a plan — then writes and runs tests with your approval."
              />

              <div className="bg-[#11141c] border border-[rgba(255,255,255,0.12)] rounded-[14px] p-[18px] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)] mb-[22px] transition-all focus-within:border-[rgba(129,140,248,0.35)] focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.14),0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]">
                <textarea
                  className="w-full bg-transparent border-none outline-none resize-none text-[#e8ebf2] text-[15.5px] leading-[1.55] min-h-[54px]"
                  placeholder="e.g., Add missing edge-case tests for coupon validation..."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
                <div className="flex items-center gap-[10px] mt-[14px] pt-[14px] border-t border-[rgba(255,255,255,0.07)]">
                  <select 
                    className="appearance-none bg-[#161a24] border border-[rgba(255,255,255,0.07)] text-[#e8ebf2] text-[12.5px] px-[12px] py-[7px] pr-[28px] rounded-[8px] cursor-pointer outline-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2712%27%20height%3D%2712%27%20fill%3D%27none%27%20stroke%3D%27%2398a1b3%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27M3%205l3%203%203-3%27%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_9px_center]"
                    value={selectedFeature} 
                    onChange={e => setSelectedFeature(e.target.value)}
                  >
                    <option>Coupon</option>
                    <option>Payment</option>
                    <option>Checkout</option>
                  </select>
                  <div className="flex-1" />
                  <Button variant="primary" size="lg" onClick={handleAnalyze} disabled={analyzing}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] mr-[6px]">
                      <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
                    </svg>
                    {analyzing ? 'Analyzing...' : 'Analyze'}
                  </Button>
                </div>
              </div>

              <div className="mb-[16px]">
                <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[10px]">Test types to consider</div>
                <div className="flex flex-wrap gap-[8px]">
                  {testTypeOptions.map(type => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`inline-flex items-center gap-[7px] text-[12.5px] font-medium px-[13px] py-[7px] rounded-[8px] cursor-pointer transition-all border ${
                        selectedTypes.includes(type) 
                          ? 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.4)] text-[#c7cdf5]' 
                          : 'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'
                      }`}
                    >
                      {selectedTypes.includes(type) && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
                          <path d="M5 12l4 4 10-10"/>
                        </svg>
                      )}
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-[26px] mt-[26px]">
                <BlockHeader label="Quick actions from dashboard insights" />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-[12px]">
                  {quickActions.map(action => (
                    <div key={action.title} className="flex gap-[12px] p-[14px] rounded-[12px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] cursor-pointer transition-all hover:border-[rgba(129,140,248,0.35)] hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]" onClick={() => handleQuickAction(action.title)}>
                      <div className="w-[34px] h-[34px] rounded-[9px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.14)] text-[#818cf8]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[17px] h-[17px]">
                          <path d="M13 3L4 14h7l-1 7 9-11h-7z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#e8ebf2] leading-[1.35] mb-[4px]">{action.title}</div>
                        <div className="text-[11.5px] text-[#6b7488]">{action.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Isolation */}
          {currentStep === 1 && (
            <div>
              <StepHeader 
                eyebrow="Step 2 — Isolation & Classification" 
                title="Here's the behavior I've isolated"
                description="Guardrail scoped your request to the Coupon module and classified what should be tested by status and risk."
              />

              <div className="grid grid-cols-2 gap-[14px] mb-[22px]">
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                  <BlockHeader label="Source & existing tests" />
                  {['src/services/coupon/coupon.ts', 'src/services/coupon/coupon.test.ts', 'src/routes/checkout/checkout.e2e.ts', 'tests/mobile/checkout.mobile.ts'].map(f => (
                    <div key={f} className="flex items-center gap-[10px] py-[9px] border-b border-[rgba(255,255,255,0.07)] text-[12.5px] last:border-b-0">
                      <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.13)] text-[#818cf8]">
                        <FileIcon type="code" />
                      </div>
                      <span className="font-mono text-[#e8ebf2] text-[12px]">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                  <BlockHeader label="Specs & QC test cases" />
                  {['Checkout Flow Spec.pdf', 'Coupon Rules.md', 'qc-checkout-suite.csv', 'qc-payment-cases.xlsx'].map(f => (
                    <div key={f} className="flex items-center gap-[10px] py-[9px] border-b border-[rgba(255,255,255,0.07)] text-[12.5px] last:border-b-0">
                      <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(251,191,36,0.13)] text-[#fbbf24]">
                        <FileIcon type="doc" />
                      </div>
                      <span className="text-[#e8ebf2] text-[12px]">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[12px] mb-[22px]">
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                  <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[6px]">Current coverage</div>
                  <div className="flex items-baseline gap-[8px] mt-[6px]">
                    <span className="font-mono text-[24px] font-bold text-[#fbbf24]">64%</span>
                    <span className="text-[12px] text-[#6b7488]">line · 52% branch</span>
                  </div>
                </div>
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                  <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[6px]">Current test status</div>
                  <div className="flex gap-[6px] mt-[8px] flex-wrap">
                    <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] text-[#fb7185] bg-[rgba(251,113,133,0.14)]">1 failed</span>
                    <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] text-[#c084fc] bg-[rgba(192,132,252,0.15)]">1 suspicious</span>
                    <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-[8px] py-[2.5px] rounded-[6px] text-[#60a5fa] bg-[rgba(96,165,250,0.14)]">4 missing</span>
                  </div>
                </div>
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                  <div className="text-[11.5px] font-semibold text-[#6b7488] uppercase tracking-[0.5px] mb-[6px]">Detected user journeys</div>
                  <div className="text-[12.5px] text-[#98a1b3] mt-[7px] leading-[1.5]">Apply coupon → checkout → pay · Expired coupon error · Stacked coupon block</div>
                </div>
              </div>

              <div className="mb-[22px]">
                <BlockHeader label="Behavior classification" count={classification.length} />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[12px]">
                  {classification.map(c => (
                    <div key={c.behavior} className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[14px] transition-all hover:border-[rgba(255,255,255,0.12)] hover:translate-y-[-2px] relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: classBorderColor[c.status] }} />
                      <div className="flex flex-wrap gap-[6px] mb-[9px] items-center">
                        <Badge variant={classStatusBadge[c.status]} dot>{c.status}</Badge>
                        <span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{c.type}</span>
                        <Badge variant={riskBadge[c.risk]}>{c.risk}</Badge>
                      </div>
                      <div className="text-[13.5px] font-semibold text-[#e8ebf2] mb-[8px]">{c.behavior}</div>
                      <div className="text-[12px] text-[#98a1b3] leading-[1.45]">{c.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-[10px] flex-wrap p-[16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px]">
                <Button variant="ghost" onClick={() => setCurrentStep(0)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] mr-[6px]">
                    <path d="M19 12H5M11 6l-6 6 6 6"/>
                  </svg>
                  Back
                </Button>
                <div className="flex-1" />
                <span className="text-[12px] text-[#6b7488]">5 areas need attention · 2 high risk</span>
                <Button variant="primary" size="lg" onClick={handleGeneratePlan} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate Test Plan'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] ml-[6px]">
                    <path d="M5 12h14M13 6l6 6-6 6"/>
                  </svg>
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Plan */}
          {currentStep === 2 && (
            <div>
              <StepHeader 
                eyebrow="Step 3 — Confirmation & Plan" 
                title="Review the plan before I touch any files"
                description="Nothing is written yet. Approve, edit, or narrow the scope — and answer a few questions so the generated tests match your product spec."
              />

              <div className="grid grid-cols-2 gap-[14px] mb-[22px]">
                <div>
                  <BlockHeader label="Proposed actions" />
                  <div className="flex flex-col gap-[9px]">
                    {planActions.map(a => (
                      <div key={a.action} className={`flex items-center gap-[12px] p-[12px_14px] bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[11px] ${
                        a.action.includes('Add') ? 'pa-add' : a.action.includes('Update') ? 'pa-update' : a.action.includes('Delete') ? 'pa-delete' : 'pa-run'
                      }`}>
                        <div className={`w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center ${
                          a.action.includes('Add') ? 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]' : 
                          a.action.includes('Update') ? 'bg-[rgba(96,165,250,0.13)] text-[#60a5fa]' : 
                          a.action.includes('Delete') ? 'bg-[rgba(251,113,133,0.14)] text-[#fb7185]' : 
                          'bg-[rgba(129,140,248,0.14)] text-[#818cf8]'
                        }`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[16px] h-[16px]">
                            {a.action.includes('Add') ? <path d="M12 5v14M5 12h14"/> : 
                             a.action.includes('Update') ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></> :
                             a.action.includes('Delete') ? <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/> :
                             <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                          </svg>
                        </div>
                        <span className="text-[13.5px] text-[#e8ebf2] font-medium">{a.action}</span>
                        <span className={`ml-auto font-mono text-[16px] font-bold ${
                          a.action.includes('Add') ? 'text-[#3ddc97]' : a.action.includes('Update') ? 'text-[#60a5fa]' : a.action.includes('Delete') ? 'text-[#fb7185]' : 'text-[#818cf8]'
                        }`}>{a.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <BlockHeader label="Risk assessment" />
                  <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                    {planRisk.map(r => (
                      <div key={r.item} className="flex items-center justify-between py-[10px] border-b border-[rgba(255,255,255,0.07)] text-[13px] last:border-b-0">
                        <span className="text-[#98a1b3]">{r.item}</span>
                        <span className={`font-mono text-[10.5px] font-bold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-[5px] ${
                          r.level === 'low' ? 'text-[#3ddc97] bg-[rgba(61,220,151,0.13)]' : 
                          r.level === 'medium' ? 'text-[#fbbf24] bg-[rgba(251,191,36,0.14)]' : 
                          'text-[#fb7185] bg-[rgba(251,113,133,0.14)]'
                        }`}>{r.level}</span>
                      </div>
                    ))}
                  </div>

                  <BlockHeader label="Files likely to change" />
                  <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px]">
                    {planFiles.map(f => (
                      <div key={f} className="flex items-center gap-[10px] py-[9px] border-b border-[rgba(255,255,255,0.07)] text-[12.5px] last:border-b-0">
                        <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.13)] text-[#818cf8]">
                          <FileIcon type="code" />
                        </div>
                        <span className="font-mono text-[#e8ebf2] text-[12px]">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-[22px]">
                <BlockHeader label="Questions before I write tests" />
                {aiQuestions.map((q, qi) => (
                  <div key={qi} className="bg-[#11141c] border border-[rgba(192,132,252,0.22)] rounded-[12px] p-[15px] mb-[11px]">
                    <div className="flex items-start gap-[10px] mb-[12px]">
                      <div className="w-[26px] h-[26px] rounded-[7px] flex-shrink-0 grid place-items-center bg-[rgba(192,132,252,0.15)] text-[#c084fc] font-bold text-[14px]">?</div>
                      <div className="text-[13.5px] text-[#e8ebf2] font-medium leading-[1.45] pt-[3px]">{q.question}</div>
                    </div>
                    <div className="flex flex-wrap gap-[8px]">
                      {q.options.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setAnsweredQuestions(prev => ({ ...prev, [qi]: opt }))}
                          className={`text-[12.5px] px-[14px] py-[8px] rounded-[8px] cursor-pointer transition-all border ${
                            answeredQuestions[qi] === opt 
                              ? 'bg-[rgba(192,132,252,0.15)] border-[rgba(192,132,252,0.5)] text-[#e8d8fa] font-semibold' 
                              : 'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-[10px] flex-wrap p-[16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px]">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] mr-[6px]">
                    <path d="M19 12H5M11 6l-6 6 6 6"/>
                  </svg>
                  Back
                </Button>
                <Button variant="outline">Edit Plan</Button>
                <Button variant="outline">Skip UI Tests</Button>
                <Button variant="outline">Unit Tests Only</Button>
                <div className="flex-1" />
                <Button variant="danger">Cancel</Button>
                <Button variant="primary" size="lg" onClick={handleApprovePlan}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] mr-[6px]">
                    <path d="M5 12l4 4 10-10"/>
                  </svg>
                  Approve Plan
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Generate */}
          {currentStep === 3 && (
            <div>
              <StepHeader 
                eyebrow="Step 4 — Generate Changes" 
                title="Writing & updating tests"
                description="Agent activity is shown live. Every change below is a proposal — nothing is applied to your repo yet."
              />

              <div className="grid grid-cols-[280px_1fr] gap-[14px] items-start mb-[22px]">
                <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] p-[16px] sticky top-[74px]">
                  <BlockHeader label="Agent activity" />
                  <div className="flex flex-col">
                    {genTimeline.map((t, i) => (
                      <div key={i} className={`flex gap-[13px] pb-[14px] relative ${t.state === 'done' ? 'done' : ''}`}>
                        {i < genTimeline.length - 1 && (
                          <div className={`absolute left-[12px] top-[26px] bottom-0 w-[1.5px] ${t.state === 'done' ? 'bg-[rgba(61,220,151,0.4)]' : 'bg-[rgba(255,255,255,0.12)]'}`} />
                        )}
                        <div className={`w-[25px] h-[25px] rounded-full flex-shrink-0 grid place-items-center z-[1] ${
                          t.state === 'done' ? 'bg-[rgba(61,220,151,0.13)] border border-[rgba(61,220,151,0.45)] text-[#3ddc97]' : 
                          'bg-[#0d0f16] border border-[rgba(255,255,255,0.12)] text-[#6b7488]'
                        }`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[13px] h-[13px]">
                            <path d="M5 12l4 4 10-10" />
                          </svg>
                        </div>
                        <div className={`text-[13px] pt-[3px] ${t.state === 'done' ? 'text-[#e8ebf2]' : 'text-[#98a1b3]'}`}>
                          {t.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-[8px] flex-wrap mb-[14px]">
                    {['All', 'add', 'update', 'delete', 'Unit', 'UI/Browser', 'Mobile'].map(f => (
                      <button
                        key={f}
                        onClick={() => setChangeFilter(f)}
                        className={`text-[12px] font-medium px-[12px] py-[6px] rounded-[7px] cursor-pointer transition-all border ${
                          changeFilter === f 
                            ? 'bg-[#1b2030] text-white border-[rgba(255,255,255,0.12)]' 
                            : 'bg-[#161a24] border-[rgba(255,255,255,0.07)] text-[#98a1b3] hover:text-[#e8ebf2]'
                        }`}
                      >
                        {f}
                        {f !== 'All' && (
                          <span className="font-mono text-[10.5px] opacity-70 ml-[4px]">
                            {f === 'add' ? changes.filter(c => c.changeType === 'add').length :
                             f === 'update' ? changes.filter(c => c.changeType === 'update').length :
                             f === 'delete' ? changes.filter(c => c.changeType === 'delete').length :
                             f === 'Unit' ? changes.filter(c => c.testType === 'unit').length :
                             f === 'UI/Browser' ? changes.filter(c => c.testType === 'ui').length :
                             f === 'Mobile' ? changes.filter(c => c.testType === 'mobile').length : ''}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-[11px] mb-[18px]">
                    {filteredChanges.map(change => (
                      <div key={change.id} className={`bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[12px] overflow-hidden transition-all hover:border-[rgba(255,255,255,0.12)] ${expandedChanges.has(change.id) ? 'open' : ''}`}>
                        <div className="flex items-start gap-[13px] p-[14px_16px] cursor-pointer" onClick={() => toggleChange(change.id)}>
                          <div className={`w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center mt-[1px] ${
                            change.changeType === 'add' ? 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]' : 
                            change.changeType === 'update' ? 'bg-[rgba(96,165,250,0.13)] text-[#60a5fa]' : 
                            'bg-[rgba(251,113,133,0.14)] text-[#fb7185]'
                          }`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[16px] h-[16px]">
                              {change.changeType === 'add' ? <path d="M12 5v14M5 12h14"/> : 
                               change.changeType === 'update' ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></> :
                               <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>}
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-[7px] flex-wrap mb-[6px]">
                              <span className={`text-[10px] font-bold uppercase tracking-[0.5px] px-[7px] py-[2px] rounded-[5px] ${
                                change.changeType === 'add' ? 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]' : 
                                change.changeType === 'update' ? 'bg-[rgba(96,165,250,0.13)] text-[#60a5fa]' : 
                                'bg-[rgba(251,113,133,0.14)] text-[#fb7185]'
                              }`}>{change.changeType}</span>
                              <span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{change.testType}</span>
                              <Badge variant="accent">{change.feature}</Badge>
                              <Badge variant={riskBadge[change.risk]}>{change.risk}</Badge>
                            </div>
                            <div className="text-[14px] font-semibold text-[#e8ebf2] leading-[1.4] mb-[5px] tracking-[-0.1px]">{change.title}</div>
                            <div className="font-mono text-[11.5px] text-[#818cf8] mb-[7px]">{change.file}</div>
                            <div className="text-[12.5px] text-[#98a1b3] leading-[1.45]">{change.reason}</div>
                          </div>
                          <div className="flex flex-col items-end gap-[7px] flex-shrink-0">
                            <span className={`text-[11px] font-semibold inline-flex items-center gap-[5px] ${
                              change.changeType === 'add' ? 'text-[#3ddc97]' : change.changeType === 'update' ? 'text-[#60a5fa]' : 'text-[#fb7185]'
                            }`}>
                              {change.changeType === 'add' ? `+${change.diff.filter(d => d.type === 'add').length} lines` : 
                               change.changeType === 'update' ? `~${change.diff.filter(d => d.type === 'add' || d.type === 'del').length} lines` :
                               `-${change.diff.filter(d => d.type === 'del').length} lines`}
                            </span>
                            <span className={`text-[#6b7488] text-[11px] transition-transform duration-200 ${expandedChanges.has(change.id) ? 'rotate-180' : ''}`}>▼</span>
                          </div>
                        </div>
                        {expandedChanges.has(change.id) && (
                          <div className="border-t border-[rgba(255,255,255,0.07)] bg-[#07090d] p-[13px_16px] font-mono text-[12px] leading-[1.7] overflow-x-auto">
                            <CodeDiff diff={change.diff} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-[22px]">
                <BlockHeader label="Before / After comparison" />
                <div className="grid grid-cols-[1fr_auto_1fr] gap-[16px] items-stretch">
                  <div className="bg-[#0d0f16] border border-[rgba(251,113,133,0.2)] rounded-[12px] p-[15px]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#fb7185] mb-[11px] flex items-center gap-[7px]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Before
                    </div>
                    <ul className="m-0 p-0 list-none flex flex-col gap-[9px]">
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#fb7185]"><path d="M5 12l4 4 10-10"/></svg>
                        0 tests for coupon minimum purchase
                      </li>
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#fb7185]"><path d="M5 12l4 4 10-10"/></svg>
                        0 timezone expiry tests
                      </li>
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#fb7185]"><path d="M5 12l4 4 10-10"/></svg>
                        1 outdated stacking test
                      </li>
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#fb7185]"><path d="M5 12l4 4 10-10"/></svg>
                        0 mobile tests for new devices
                      </li>
                    </ul>
                  </div>
                  <div className="grid place-items-center text-[#6b7488]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[22px] h-[22px]"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                  <div className="bg-[#0d0f16] border border-[rgba(61,220,151,0.25)] rounded-[12px] p-[15px]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-[#3ddc97] mb-[11px] flex items-center gap-[7px]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]"><path d="M5 12l4 4 10-10"/></svg>
                      After
                    </div>
                    <ul className="m-0 p-0 list-none flex flex-col gap-[9px]">
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#3ddc97]"><path d="M5 12l4 4 10-10"/></svg>
                        9 new tests added
                      </li>
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#3ddc97]"><path d="M5 12l4 4 10-10"/></svg>
                        1 test updated
                      </li>
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#3ddc97]"><path d="M5 12l4 4 10-10"/></svg>
                        1 outdated test removed
                      </li>
                      <li className="text-[12.5px] text-[#98a1b3] flex gap-[8px] leading-[1.45]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 mt-[2px] text-[#3ddc97]"><path d="M5 12l4 4 10-10"/></svg>
                        6 files changed
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-[10px]">
                <Button variant="ghost" onClick={() => setCurrentStep(2)}>Back</Button>
                <Button variant="primary" size="lg" onClick={handleRunTests}>Run Tests</Button>
              </div>
            </div>
          )}

          {/* Step 5: Run */}
          {currentStep === 4 && (
            <div>
              <StepHeader 
                eyebrow="Step 5 — Run Tests" 
                title="Running tests..."
              />

              <div className="mb-[18px]">
                <ProgressBar value={runProgress} />
                <div className="text-[11px] text-[#6b7488] mt-[6px]">{runProgress}% complete</div>
              </div>

              <div className="flex flex-col gap-[18px] mb-[18px]">
                {/* Unit Tests */}
                <div className="mb-[18px]">
                  <div className="flex items-center gap-[11px] p-[13px_16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px_12px_0_0]">
                    <div className="w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.14)] text-[#818cf8]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[16px] h-[16px]">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#e8ebf2]">Unit Tests</div>
                      <div className="font-mono text-[11.5px] text-[#6b7488] mt-[1px]"><span className="text-[#3ddc97]">$</span> pnpm test --filter=unit</div>
                    </div>
                    <div className="ml-auto flex items-center gap-[12px]">
                      <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px] text-[#3ddc97] bg-[rgba(61,220,151,0.13)]">6/6 pass</span>
                      <span className="text-[11px] text-[#6b7488]">1.2s</span>
                    </div>
                  </div>
                  <div className="border border-[rgba(255,255,255,0.07)] border-t-0 rounded-[0_0_12px_12px] p-[14px_16px]">
                    <div className="flex gap-[18px] text-[12.5px] text-[#98a1b3] mb-[4px]">
                      <div><b className="text-[#e8ebf2] font-mono">42ms</b> apply valid coupon</div>
                      <div><b className="text-[#e8ebf2] font-mono">38ms</b> reject expired</div>
                      <div><b className="text-[#e8ebf2] font-mono">31ms</b> minimum purchase</div>
                    </div>
                  </div>
                </div>

                {/* UI/Browser Tests */}
                <div className="mb-[18px]">
                  <div className="flex items-center gap-[11px] p-[13px_16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px_12px_0_0]">
                    <div className="w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center bg-[rgba(129,140,248,0.14)] text-[#818cf8]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[16px] h-[16px]">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#e8ebf2]">UI/Browser Tests</div>
                      <div className="font-mono text-[11.5px] text-[#6b7488] mt-[1px]"><span className="text-[#3ddc97]">$</span> pnpm test:e2e</div>
                    </div>
                    <div className="ml-auto flex items-center gap-[12px]">
                      <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px] text-[#3ddc97] bg-[rgba(61,220,151,0.13)]">3/3 pass</span>
                      <span className="text-[11px] text-[#6b7488]">8.4s</span>
                    </div>
                  </div>
                  <div className="border border-[rgba(255,255,255,0.07)] border-t-0 rounded-[0_0_12px_12px] p-[14px_16px]">
                    <div className="flex gap-[12px] flex-wrap mt-[12px]">
                      <div className="w-[280px] border border-[rgba(255,255,255,0.12)] rounded-[10px] overflow-hidden bg-[#11141c]">
                        <div className="flex items-center gap-[6px] p-[7px_10px] bg-[#1b2030] border-b border-[rgba(255,255,255,0.07)]">
                          <span className="w-[8px] h-[8px] rounded-full bg-[#fb7185]" />
                          <span className="w-[8px] h-[8px] rounded-full bg-[#fbbf24]" />
                          <span className="w-[8px] h-[8px] rounded-full bg-[#3ddc97]" />
                          <span className="flex-1 ml-[6px] font-mono text-[9.5px] text-[#6b7488] bg-[#0d0f16] px-[8px] py-[3px] rounded-[5px]">localhost:3000/checkout</span>
                        </div>
                        <div className="p-[14px] min-h-[130px] bg-[linear-gradient(180deg,#0f1320,#0c0f18)] relative">
                          <div className="text-[10px] text-[#6b7488] mb-[8px]">Cart</div>
                          <div className="flex items-center gap-[8px] bg-[rgba(251,113,133,0.14)] border border-[rgba(251,113,133,0.4)] text-[#ffc9d2] rounded-[8px] p-[9px_11px] text-[11px]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] flex-shrink-0 text-[#fb7185]"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                            Session expired. Please refresh.
                          </div>
                          <div className="h-[8px] rounded-[4px] bg-[rgba(255,255,255,0.07)] mb-[7px] w-[60%] mt-[8px]" />
                          <div className="h-[8px] rounded-[4px] bg-[rgba(255,255,255,0.07)] mb-[7px] w-[80%]" />
                          <div className="h-[8px] rounded-[4px] bg-[rgba(255,255,255,0.07)] mb-[7px] w-[40%]" />
                          <div className="h-[26px] rounded-[6px] bg-[linear-gradient(160deg,#8b93ff,#5d68f0)] w-[110px] mt-[10px]" />
                        </div>
                      </div>
                    </div>
                    <div className="text-[10.5px] text-[#6b7488] mt-[8px] flex items-center gap-[6px]">
                      <span className="text-[#3ddc97]">✓</span> Visual check passed — timeout message visible
                    </div>
                  </div>
                </div>

                {/* Mobile Tests */}
                <div className="mb-[18px]">
                  <div className="flex items-center gap-[11px] p-[13px_16px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[12px_12px_0_0]">
                    <div className="w-[30px] h-[30px] rounded-[8px] flex-shrink-0 grid place-items-center bg-[rgba(251,113,133,0.14)] text-[#fb7185]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[16px] h-[16px]">
                        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" x2="12" y1="18" y2="18"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#e8ebf2]">Mobile Tests</div>
                      <div className="font-mono text-[11.5px] text-[#6b7488] mt-[1px]"><span className="text-[#fb7185]">$</span> pnpm test:mobile</div>
                    </div>
                    <div className="ml-auto flex items-center gap-[12px]">
                      <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px] text-[#fb7185] bg-[rgba(251,113,133,0.14)]">1/2 pass</span>
                      <span className="text-[11px] text-[#6b7488]">12.8s</span>
                    </div>
                  </div>
                  <div className="border border-[rgba(255,255,255,0.07)] border-t-0 rounded-[0_0_12px_12px] p-[14px_16px]">
                    <div className="flex gap-[12px] flex-wrap mt-[12px]">
                      <div className="w-[150px] border-2 border-[rgba(255,255,255,0.12)] rounded-[20px] overflow-hidden bg-black p-[6px]">
                        <div className="w-[44px] h-[5px] rounded-full bg-[#2a3142] mx-auto mb-[6px] mt-[2px]" />
                        <div className="rounded-[13px] overflow-hidden bg-[linear-gradient(180deg,#0f1320,#0c0f18)] p-[12px_11px] min-h-[220px] relative">
                          <div className="text-[11px] text-[#e8ebf2] font-semibold mb-[12px] text-center">Checkout</div>
                          <div className="bg-[#0d0f16] border border-[rgba(255,255,255,0.12)] rounded-[7px] p-[8px_9px] font-mono text-[9.5px] text-[#e8ebf2] mb-[8px]">
                            <span className="text-[7.5px] text-[#6b7488] block mb-[2px] font-sans">Coupon</span>
                            SAVE10
                          </div>
                          <div className="bg-[rgba(251,191,36,0.14)] border border-[rgba(251,191,36,0.4)] text-[#f4dca0] rounded-[7px] p-[7px_8px] text-[8.5px] mb-[8px] flex gap-[5px] items-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[11px] h-[11px] flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                            Coupon expired
                          </div>
                          <div className="h-[24px] rounded-[6px] bg-[linear-gradient(160deg,#8b93ff,#5d68f0)]" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-[180px] bg-[#07090d] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-[11px_13px] font-mono text-[10.5px] leading-[1.7] text-[#98a1b3]">
                        <div><span className="text-[#6b7488]">[10:42:03]</span> Launch Pixel 7 emulator</div>
                        <div><span className="text-[#6b7488]">[10:42:05]</span> <span className="text-[#3ddc97]">OK</span> Form visible</div>
                        <div><span className="text-[#6b7488]">[10:42:06]</span> <span className="text-[#3ddc97]">OK</span> Coupon applied</div>
                        <div><span className="text-[#6b7488]">[10:42:08]</span> <span className="text-[#fbbf24]">WARN</span> Payment sheet timeout</div>
                        <div><span className="text-[#6b7488]">[10:42:12]</span> <span className="text-[#fb7185]">FAIL</span> iPhone 15 retry</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-[18px]">
                <BlockHeader label="Coverage comparison" />
                <div className="grid grid-cols-4 gap-[12px]">
                  {covCompare.map(c => (
                    <div key={c.metric} className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[14px]">
                      <div className="text-[11.5px] text-[#98a1b3] mb-[9px]">{c.metric}</div>
                      <div className="flex items-baseline gap-[8px]">
                        <span className="font-mono text-[15px] text-[#6b7488] line-through">{c.before}%</span>
                        <span className="font-mono text-[24px] font-bold tracking-[-0.5px] text-white">{c.after}%</span>
                        <span className="text-[11px] font-bold text-[#3ddc97] ml-auto">+{c.after - c.before}%</span>
                      </div>
                      <div className="h-[6px] rounded-full bg-[rgba(255,255,255,0.06)] mt-[11px] overflow-hidden relative">
                        <div className="absolute left-0 top-0 bottom-0 rounded-full bg-[#818cf8]" style={{ width: `${c.after}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-[18px]">
                <BlockHeader label="Test results" />
                <table className="w-full border-collapse text-[12.5px] mt-[4px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">Test</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">Type</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">Status</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">Duration</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">Evidence</th>
                      <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold p-[9px_12px] border-b border-[rgba(255,255,255,0.07)]">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map(row => (
                      <tr key={row.name} className="hover:bg-[rgba(255,255,255,0.018)]">
                        <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] text-[#e8ebf2] font-medium">{row.name}</td>
                        <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] text-[#98a1b3]">
                          <span className="font-mono text-[10.5px] bg-[#1b2030] border border-[rgba(255,255,255,0.07)] text-[#98a1b3] px-[8px] py-[2px] rounded-[6px]">{row.type}</span>
                        </td>
                        <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)]">
                          <span className={`inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[3px] rounded-[7px] ${
                            row.status === 'pass' ? 'text-[#3ddc97] bg-[rgba(61,220,151,0.13)]' : 
                            row.status === 'fail' ? 'text-[#fb7185] bg-[rgba(251,113,133,0.14)]' : 
                            'text-[#818cf8] bg-[rgba(129,140,248,0.14)]'
                          }`}>
                            <StatusIcon status={row.status} />
                            {row.status}
                          </span>
                        </td>
                        <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] text-[#98a1b3]">{row.duration}</td>
                        <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)]">
                          {row.evidence && (
                            <span className="text-[#818cf8] text-[11.5px] cursor-pointer inline-flex items-center gap-[5px] hover:underline">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[12px] h-[12px]"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              {row.evidence}
                            </span>
                          )}
                        </td>
                        <td className="p-[11px_12px] border-b border-[rgba(255,255,255,0.07)] font-mono text-[11px] text-[#6b7488]">{row.file}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[rgba(251,113,133,0.05)] border border-[rgba(251,113,133,0.28)] rounded-[12px] p-[16px] mt-[14px]">
                <div className="flex items-center gap-[9px] text-[13.5px] font-semibold text-[#fb7185] mb-[12px]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[17px] h-[17px]"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  Payment sheet on iPhone 15
                </div>
                <div className="text-[12.5px] text-[#98a1b3] mb-[8px] leading-[1.5]">Test fails intermittently on iPhone 15 simulator. Passes on Pixel 7.</div>
                <div className="flex gap-[9px] flex-wrap mt-[13px]">
                  <Button variant="outline" size="default" className="text-[11px]">Ask agent to fix</Button>
                  <Button variant="ghost" size="default" className="text-[11px]">Accept</Button>
                  <Button variant="danger" size="default" className="text-[11px]">Revert</Button>
                </div>
              </div>

              <div className="flex gap-[10px] mt-[18px]">
                <Button variant="ghost" onClick={() => setCurrentStep(3)}>Back</Button>
                <Button variant="primary" size="lg" onClick={() => setCurrentStep(5)}>Review & Apply</Button>
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 5 && (
            <div>
              <StepHeader
                eyebrow="Step 6 — Review & Apply"
                title="Review the full change set"
                description="You're in control. Apply changes to your working tree, open a PR, or revert everything — Guardrail never commits without your action."
              />

              <div className="flex items-start gap-[11px] p-[14px_16px] bg-[rgba(61,220,151,0.08)] border border-[rgba(61,220,151,0.2)] rounded-[12px] mb-[18px] text-[13px] text-[#b6f0d4] leading-[1.5]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px] flex-shrink-0 text-[#3ddc97] mt-[1px]">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
                <div>
                  <b className="text-[#d6fae8]">Recommended: Apply changes</b> — 10 of 11 tests pass. Coverage improved from 64% to 78%. 1 mobile test fails on iPhone 15.
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[12px] mb-[20px]">
                {reviewStats.map((s, i) => {
                  const colors = ['#3ddc97', '#60a5fa', '#fb7185', '#3ddc97', '#3ddc97', '#fbbf24', '#fb7185', '#818cf8'];
                  return (
                    <div key={s.label} className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[15px] relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: colors[i] }} />
                      <div className="text-[26px] font-bold tracking-[-0.8px] leading-[1] text-white">{s.value}</div>
                      <div className="text-[11.5px] text-[#98a1b3] mt-[7px]">{s.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mb-[18px]">
                <BlockHeader label="Files changed" />
                <div className="flex flex-col gap-[6px]">
                  {reviewFiles.map(f => (
                    <div key={f.path} className="flex items-center gap-[10px] bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[12px] h-[12px] text-[#818cf8] flex-shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="text-[12px] font-mono text-[#e8ebf2] flex-1">{f.path}</span>
                      <span className="text-[11px] text-[#3ddc97] font-medium">+{f.additions}</span>
                      <span className="text-[11px] text-[#fb7185] font-medium">-{f.deletions}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-[18px]">
                <BlockHeader label="Remaining risk" />
                <div className="flex flex-col gap-[6px]">
                  {[
                    { item: 'Pixel 7 retry timing', level: 'medium' as const },
                    { item: 'Production code changes', level: 'medium' as const },
                    { item: 'Open questions not answered', level: 'low' as const },
                    { item: 'Visual baselines need update', level: 'low' as const },
                  ].map(r => (
                    <div key={r.item} className="flex items-center gap-[12px] bg-[#0d0f16] rounded-[8px] px-[12px] py-[8px]">
                      <div className="flex-1">
                        <div className="text-[12px] text-[#e8ebf2]">{r.item}</div>
                        <div className="w-full h-[3px] bg-[rgba(255,255,255,0.05)] rounded-full mt-[4px] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: r.level === 'medium' ? '60%' : '30%', backgroundColor: riskColor[r.level] }} />
                        </div>
                      </div>
                      <Badge variant={riskBadge[r.level]}>{r.level}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-[10px] flex-wrap p-[18px] bg-[#161a24] border border-[rgba(255,255,255,0.12)] rounded-[12px]">
                <Button variant="ghost" onClick={() => setCurrentStep(4)}>Back</Button>
                <Button variant="danger">Revert All</Button>
                <Button variant="outline">Export Test Plan</Button>
                <Button variant="outline" onClick={handleCreatePR}>Create PR</Button>
                <div className="flex-1" />
                <Button variant="primary" size="lg" onClick={handleApplyChanges}>Apply Changes</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
