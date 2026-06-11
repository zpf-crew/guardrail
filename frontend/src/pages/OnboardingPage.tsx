import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stepper, type Step } from '@/components/ui/stepper';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileRow } from '@/components/ui/file-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/components/ui/toast';
import { repoInfo, mockDocs, mockQCs, qcRows, scanTasks, scanLogs, summaryStats } from '@/data/onboardingMockData';

const stepDefs = [
  { title: 'Repository', optional: false },
  { title: 'Product Knowledge', optional: true },
  { title: 'QC Test Cases', optional: true },
  { title: 'Initial Scan', optional: false },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [docs, setDocs] = React.useState(mockDocs);
  const [qcs, setQCs] = React.useState(mockQCs);
  const [docLink, setDocLink] = React.useState('');
  const [docLinks, setDocLinks] = React.useState<string[]>([]);
  const [scanComplete, setScanComplete] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanLogIndex, setScanLogIndex] = React.useState(0);
  const [scanTaskIndex, setScanTaskIndex] = React.useState(0);

  const taskIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const logIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (taskIntervalRef.current) {
        clearInterval(taskIntervalRef.current);
        taskIntervalRef.current = null;
      }
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
        logIntervalRef.current = null;
      }
    };
  }, []);

  const steps: Step[] = stepDefs.map((s, i) => {
    if (i < currentStep) return { ...s, state: 'done' as const };
    if (i === currentStep) return { ...s, state: 'current' as const };
    return { ...s, state: 'todo' as const };
  });

  const handleDeleteDoc = (name: string) => {
    setDocs(prev => prev.filter(d => d.name !== name));
    toast('File removed', 'success');
  };

  const handleDeleteQC = (name: string) => {
    setQCs(prev => prev.filter(d => d.name !== name));
    toast('File removed', 'success');
  };

  const handleAddDoc = () => {
    const newFiles = [
      { name: 'API Reference.pdf', type: 'pdf' as const, size: '1.2 MB' },
      { name: 'User Guide.md', type: 'md' as const, size: '24 KB' },
    ];
    const next = newFiles[Math.floor(Math.random() * newFiles.length)];
    if (!docs.find(d => d.name === next.name)) {
      setDocs(prev => [...prev, next]);
      toast('File uploaded', 'success');
    }
  };

  const handleAddQC = () => {
    const newFiles = [
      { name: 'qc-regression-suite.csv', type: 'csv' as const, size: '48 KB' },
    ];
    const next = newFiles[0];
    if (!qcs.find(d => d.name === next.name)) {
      setQCs(prev => [...prev, next]);
      toast('File uploaded', 'success');
    }
  };

  const handleAddDocLink = () => {
    if (docLink.trim()) {
      setDocLinks(prev => [...prev, docLink.trim()]);
      toast('Link added', 'success');
      setDocLink('');
    }
  };

  const startScan = () => {
    if (taskIntervalRef.current) clearInterval(taskIntervalRef.current);
    if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    setCurrentStep(3);
    setScanProgress(0);
    setScanLogIndex(0);
    setScanTaskIndex(0);
    toast('Scan started', 'loading');

    let taskIdx = 0;
    let logIdx = 0;
    taskIntervalRef.current = setInterval(() => {
      taskIdx++;
      setScanTaskIndex(taskIdx);
      setScanProgress(Math.round((taskIdx / scanTasks.length) * 100));
      if (taskIdx >= scanTasks.length) {
        if (taskIntervalRef.current) clearInterval(taskIntervalRef.current);
        taskIntervalRef.current = null;
        setScanComplete(true);
        toast('Scan complete', 'success');
      }
    }, 800);

    logIntervalRef.current = setInterval(() => {
      logIdx++;
      setScanLogIndex(logIdx);
      if (logIdx >= scanLogs.length) {
        if (logIntervalRef.current) clearInterval(logIntervalRef.current);
        logIntervalRef.current = null;
      }
    }, 600);
  };

  const handleStepClick = (index: number) => {
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  };

  return (
    <div className="min-h-screen p-[28px]" style={{ fontFamily: 'var(--sans)' }}>
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center justify-between mb-[28px]">
          <div className="flex items-center gap-[11px]">
            <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-[19px] h-[19px]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M8 10.5l1.8 1.8L13.5 8.5" /></svg>
            </div>
            <h1 className="text-[20px] font-semibold text-[#e8ebf2]"><b className="text-white">Guard</b>rail</h1>
          </div>
          <Button variant="ghost" onClick={() => navigate('/')}>Skip setup</Button>
        </div>

        <div className="mb-[32px]">
          <h2 className="text-[28px] font-bold text-white mb-[8px]">Set up your repository</h2>
          <p className="text-[15px] text-[#98a1b3] leading-[1.55] max-w-[520px]">
            Guardrail combines code, specs, QC cases, and test runs to understand your testing health.
          </p>
        </div>

        <div className="grid grid-cols-[218px_1fr] gap-[28px]">
          <Panel className="p-[18px] h-fit">
            <Stepper steps={steps} onStepClick={handleStepClick} />
          </Panel>

          <Panel className="p-[26px]">
            {currentStep === 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 1 — Repository</div>
                <h3 className="text-[18px] font-semibold text-white mb-[4px]">Select your repository</h3>
                <p className="text-[13.5px] text-[#98a1b3] mb-[22px]">Choose a GitHub repository to analyze for testing intelligence.</p>

                <div className="mb-[18px]">
                  <label className="text-[12.5px] text-[#98a1b3] mb-[6px] block">GitHub Repository</label>
                  <select className="w-full bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] px-[12px] py-[10px] text-[#e8ebf2] text-[13.5px] outline-none focus:border-[rgba(129,140,248,0.35)]">
                    <option>{repoInfo.name}</option>
                  </select>
                </div>

                <div className="flex gap-[10px] mb-[22px]">
                  <Badge variant="accent" dot>repo: {repoInfo.name}</Badge>
                  <Badge variant="gray">branch: {repoInfo.branch}</Badge>
                </div>

                <div className="flex gap-[10px]">
                  <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
                  <Button variant="primary" size="lg" onClick={() => setCurrentStep(1)}>Continue</Button>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 2 — Product Knowledge <span className="text-[#6b7488]">(Optional)</span></div>
                <h3 className="text-[18px] font-semibold text-white mb-[4px]">Add product documentation</h3>
                <p className="text-[13.5px] text-[#98a1b3] mb-[22px]">Upload specs, wikis, or design docs so Guardrail understands what should happen.</p>

                <div
                  className="border-2 border-dashed border-[rgba(255,255,255,0.12)] rounded-[12px] p-[28px] text-center mb-[18px] cursor-pointer hover:border-[rgba(129,140,248,0.35)] transition-colors"
                  onClick={handleAddDoc}
                >
                  <div className="text-[28px] mb-[8px]">📄</div>
                  <div className="text-[13.5px] text-[#98a1b3]">Drop files here or <span className="text-[#818cf8]">click to upload</span></div>
                  <div className="text-[11px] text-[#6b7488] mt-[4px]">PDF, MD, TXT up to 10MB</div>
                </div>

                {docs.length > 0 && (
                  <div className="flex flex-col gap-[8px] mb-[18px]">
                    {docs.map(doc => (
                      <FileRow key={doc.name} name={doc.name} type={doc.type} size={doc.size} onDelete={() => handleDeleteDoc(doc.name)} />
                    ))}
                  </div>
                )}

                <div className="mb-[18px]">
                  <label className="text-[12.5px] text-[#98a1b3] mb-[6px] block">Or reference a documentation source by link</label>
                  <div className="flex gap-[8px]">
                    <input
                      className="flex-1 bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] px-[12px] py-[9px] text-[#e8ebf2] text-[13.5px] outline-none focus:border-[rgba(129,140,248,0.35)]"
                      placeholder="https://..."
                      value={docLink}
                      onChange={e => setDocLink(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleAddDocLink}>Add</Button>
                  </div>
                  {docLinks.length > 0 && (
                    <div className="flex flex-wrap gap-[6px] mt-[10px]">
                      {docLinks.map((link, i) => (
                        <span key={link} className="inline-flex items-center gap-[5px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] rounded-[6px] px-[9px] py-[4px] text-[12px] text-[#818cf8]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[12px] h-[12px]"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                          {link}
                          <button onClick={() => setDocLinks(prev => prev.filter((_, j) => j !== i))} className="text-[#6b7488] hover:text-[#fb7185]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[11px] h-[11px]"><path d="M6 6l12 12M18 6L6 18" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-[10px]">
                  <Button variant="ghost" onClick={() => setCurrentStep(0)}>Back</Button>
                  <Button variant="ghost" onClick={() => setCurrentStep(2)}>Skip</Button>
                  <Button variant="primary" size="lg" onClick={() => setCurrentStep(2)}>Continue</Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 3 — QC Test Cases <span className="text-[#6b7488]">(Optional)</span></div>
                <h3 className="text-[18px] font-semibold text-white mb-[4px]">Add QC / manual test cases</h3>
                <p className="text-[13.5px] text-[#98a1b3] mb-[22px]">Upload your existing QC test cases so Guardrail knows what humans verify.</p>

                <div
                  className="border-2 border-dashed border-[rgba(255,255,255,0.12)] rounded-[12px] p-[28px] text-center mb-[18px] cursor-pointer hover:border-[rgba(129,140,248,0.35)] transition-colors"
                  onClick={handleAddQC}
                >
                  <div className="text-[28px] mb-[8px]">📋</div>
                  <div className="text-[13.5px] text-[#98a1b3]">Drop files here or <span className="text-[#818cf8]">click to upload</span></div>
                  <div className="text-[11px] text-[#6b7488] mt-[4px]">CSV, XLSX up to 10MB</div>
                </div>

                {qcs.length > 0 && (
                  <div className="flex flex-col gap-[8px] mb-[18px]">
                    {qcs.map(qc => (
                      <FileRow key={qc.name} name={qc.name} type={qc.type} size={qc.size} status="Parsed" onDelete={() => handleDeleteQC(qc.name)} />
                    ))}
                  </div>
                )}

                {qcRows.length > 0 && (
                  <div className="mb-[18px]">
                    <div className="text-[12px] text-[#98a1b3] mb-[8px] font-semibold">Preview ({qcRows.length} cases)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-[#6b7488] border-b border-[rgba(255,255,255,0.07)]">
                            <th className="text-left py-[8px] px-[10px] font-semibold">ID</th>
                            <th className="text-left py-[8px] px-[10px] font-semibold">Feature</th>
                            <th className="text-left py-[8px] px-[10px] font-semibold">Scenario</th>
                            <th className="text-left py-[8px] px-[10px] font-semibold">Priority</th>
                            <th className="text-left py-[8px] px-[10px] font-semibold">Automated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qcRows.map(row => (
                            <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] text-[#e8ebf2]">
                              <td className="py-[7px] px-[10px] font-mono text-[#818cf8]">{row.id}</td>
                              <td className="py-[7px] px-[10px]">{row.feature}</td>
                              <td className="py-[7px] px-[10px]">{row.scenario}</td>
                              <td className="py-[7px] px-[10px]">
                                <Badge variant={row.priority === 'Critical' ? 'fail' : row.priority === 'High' ? 'flaky' : 'gray'}>{row.priority}</Badge>
                              </td>
                              <td className="py-[7px] px-[10px]">{row.automated}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-[10px]">
                  <Button variant="ghost" onClick={() => setCurrentStep(1)}>Back</Button>
                  <Button variant="ghost" onClick={startScan}>Skip</Button>
                  <Button variant="primary" size="lg" onClick={startScan}>Continue</Button>
                </div>
              </div>
            )}

            {currentStep === 3 && !scanComplete && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px]">Step 4 — Initial Scan</div>
                <h3 className="text-[18px] font-semibold text-white mb-[4px]">Scanning repository...</h3>
                <p className="text-[13.5px] text-[#98a1b3] mb-[22px]">Guardrail is analyzing code, tests, specs, and QC cases.</p>

                <div className="mb-[18px]">
                  <ProgressBar value={scanProgress} />
                  <div className="text-[11px] text-[#6b7488] mt-[6px]">{scanProgress}% complete</div>
                </div>

                <div className="mb-[18px]">
                  {scanTasks.map((task, i) => (
                    <div key={i} className={`flex items-center gap-[8px] py-[6px] text-[13px] ${i < scanTaskIndex ? 'text-[#3ddc97]' : i === scanTaskIndex ? 'text-[#818cf8]' : 'text-[#6b7488]'}`}>
                      {i < scanTaskIndex ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[14px] h-[14px]"><path d="M5 12l4 4 10-10" /></svg>
                      ) : i === scanTaskIndex ? (
                        <span className="w-[14px] h-[14px] rounded-full border-2 border-[rgba(129,140,248,0.3)] border-t-[#818cf8] animate-spin" />
                      ) : (
                        <span className="w-[14px] h-[14px] rounded-full border border-[rgba(255,255,255,0.12)]" />
                      )}
                      {task.label}
                    </div>
                  ))}
                </div>

                <Panel className="bg-[#0d0f16] p-[14px] font-mono text-[11.5px] text-[#98a1b3] max-h-[180px] overflow-y-auto">
                  {scanLogs.slice(0, scanLogIndex).map((log, i) => (
                    <div key={i} className="py-[2px]">{log}</div>
                  ))}
                </Panel>
              </div>
            )}

            {currentStep === 3 && scanComplete && (
              <div className="text-center">
                <div className="text-[48px] mb-[12px]">✅</div>
                <h3 className="text-[22px] font-semibold text-white mb-[6px]">Scan complete</h3>
                <p className="text-[14px] text-[#98a1b3] mb-[28px]">Guardrail has analyzed your repository and built testing intelligence.</p>

                <div className="grid grid-cols-4 gap-[12px] mb-[28px]">
                  {summaryStats.map(stat => (
                    <Panel key={stat.label} className="p-[14px] text-center">
                      <div className="text-[20px] mb-[4px]">{stat.icon}</div>
                      <div className="text-[18px] font-bold text-white">{stat.value}</div>
                      <div className="text-[11px] text-[#6b7488]">{stat.label}</div>
                    </Panel>
                  ))}
                </div>

                <div className="flex gap-[10px] justify-center">
                  <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
                  <Button variant="primary" size="lg" onClick={() => navigate('/dashboard')}>Open Dashboard</Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
