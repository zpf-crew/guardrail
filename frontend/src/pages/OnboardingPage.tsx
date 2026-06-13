import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Panel } from '@/components/ui/panel';
import { Stepper, type Step } from '@/components/ui/stepper';
import { Button } from '@/components/ui/button';
import { FileRow } from '@/components/ui/file-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SearchInput } from '@/components/ui/search-input';
import { useToast } from '@/components/ui/toast';
import {
  repoInfo,
  scanTasks,
} from '@/data/onboardingMockData';
import {
  LightbulbIcon,
  UploadIcon,
  GithubIcon,
  GitBranchIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  LinkIcon,
  XIcon,
  PlayIcon,
  CheckIcon,
  RefreshIcon,
  LayoutDashboardIcon,
  InfoCircleIcon,
  ScanTaskStatusIcon,
} from '@/components/icons';
import type { ConnectedRepo, GitHubRepoSummary, OnboardingDraft, QCTestCase, ScanSummary, UploadedFile } from '@/types/testlens';
import { connectRepo, listGitHubRepos } from '@/data/repos-api';
import { commitOnboardingScan, normalizeQCPriority, toUploadedFile, type KnowledgeDocWithSnippet } from '@/data/onboarding-api';
import { useAuth } from '@/app/auth-context';

const stepDefs = [
  { title: 'Select Repository', optional: false },
  { title: 'Product Knowledge', optional: true },
  { title: 'QC Test Cases', optional: true },
  { title: 'Initial Scan', optional: false },
];

const autoMeta: Record<string, { label: string; color: string }> = {
  automated: { label: 'Automated', color: '#3ddc97' },
  missing: { label: 'Missing', color: '#60a5fa' },
  unknown: { label: 'Unknown', color: '#8b94a7' },
};

const prioClass: Record<string, string> = {
  critical: 'bg-[rgba(251,113,133,0.14)] text-[#fb7185]',
  high: 'bg-[rgba(251,191,36,0.14)] text-[#fbbf24]',
  medium: 'bg-[rgba(96,165,250,0.14)] text-[#60a5fa]',
  low: 'bg-[rgba(139,148,167,0.16)] text-[#8b94a7]',
};

function CardHead({ eyebrow, title, description }: { eyebrow: React.ReactNode; title: string; description: React.ReactNode }) {
  return (
    <div className="px-[22px] pt-[20px] pb-[16px] border-b border-[rgba(255,255,255,0.07)]">
      <div className="text-[11px] font-bold tracking-[0.9px] text-[#818cf8] uppercase flex items-center gap-[8px] mb-[9px]">{eyebrow}</div>
      <h2 className="text-[19px] font-semibold tracking-[-0.3px] text-white mb-[6px]">{title}</h2>
      <p className="text-[13.5px] text-[#98a1b3] m-0 leading-[1.5] max-w-[640px]">{description}</p>
    </div>
  );
}

function StepFoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[12px] px-[22px] py-[16px] border-t border-[rgba(255,255,255,0.07)]">
      {children}
    </div>
  );
}

function OptionalBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[10px] p-[11px_14px] bg-[rgba(192,132,252,0.06)] border border-[rgba(192,132,252,0.2)] rounded-[11px] text-[12.5px] text-[#d9c4f5] mb-[18px] leading-[1.5]">
      <LightbulbIcon className="w-[16px] h-[16px] flex-shrink-0 text-[#c084fc]" />
      <span>{children}</span>
    </div>
  );
}

function Dropzone({ title, subtitle, accept, onClick }: { title: string; subtitle: string; accept: string; onClick: () => void }) {
  return (
    <div
      className="border-[1.5px] border-dashed border-[rgba(255,255,255,0.12)] rounded-[13px] p-[28px_22px] text-center cursor-pointer bg-[#0d0f16] transition-all mb-[18px] hover:border-[rgba(129,140,248,0.35)] hover:bg-[rgba(129,140,248,0.04)]"
      onClick={onClick}
    >
      <div className="w-[46px] h-[46px] rounded-[12px] mx-auto mb-[12px] grid place-items-center bg-[rgba(129,140,248,0.14)] text-[#818cf8]">
        <UploadIcon strokeWidth={1.8} className="w-[24px] h-[24px]" />
      </div>
      <div className="text-[14.5px] font-semibold mb-[5px] text-[#e8ebf2]">{title}</div>
      <div className="text-[12.5px] text-[#6b7488]">{subtitle}</div>
      <div className="font-mono text-[11px] text-[#818cf8] mt-[9px]">{accept}</div>
    </div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [stepStates, setStepStates] = React.useState<Step['state'][]>(['current', 'todo', 'todo', 'todo']);
  const [repos, setRepos] = React.useState<GitHubRepoSummary[]>([]);
  const [repoLoading, setRepoLoading] = React.useState(true);
  const [repoError, setRepoError] = React.useState<string | null>(null);
  const [selectedGithubRepoId, setSelectedGithubRepoId] = React.useState<number | null>(null);
  const [connectingRepo, setConnectingRepo] = React.useState(false);
  const [connectedRepo, setConnectedRepo] = React.useState<ConnectedRepo | null>(null);
  const [repoSearch, setRepoSearch] = React.useState('');
  const [docs, setDocs] = React.useState<KnowledgeDocWithSnippet[]>([]);
  const [qcs, setQCs] = React.useState<UploadedFile[]>([]);
  const [qcPreview, setQcPreview] = React.useState<QCTestCase[]>([]);
  const [docSources, setDocSources] = React.useState<string[]>([]);
  const [docSourceInput, setDocSourceInput] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [scanStarted, setScanStarted] = React.useState(false);
  const [scanComplete, setScanComplete] = React.useState(false);
  const [scanTaskIndex, setScanTaskIndex] = React.useState(-1);
  const [scanLogMessages, setScanLogMessages] = React.useState<Array<{ tag: 'ok' | 'warn' | 'info'; message: string; at?: string }>>([]);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanStepLabel, setScanStepLabel] = React.useState('Preparing…');
  const [scanEta, setScanEta] = React.useState('');
  const [scanSummary, setScanSummary] = React.useState<ScanSummary | null>(null);

  const scanTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const docInputRef = React.useRef<HTMLInputElement | null>(null);
  const qcInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  const loadRepos = React.useCallback(async () => {
    setRepoLoading(true);
    setRepoError(null);
    try {
      const nextRepos = await listGitHubRepos();
      setRepos(nextRepos);
      setSelectedGithubRepoId(current => current ?? nextRepos[0]?.githubRepoId ?? null);
    } catch (e) {
      setRepoError(e instanceof Error ? e.message : 'Failed to load repositories.');
    } finally {
      setRepoLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  const steps: Step[] = stepDefs.map((s, i) => ({ ...s, state: stepStates[i] }));

  const goToStep = (index: number) => {
    if (index < 0 || index >= stepDefs.length || (scanning && index !== 3)) return;
    setCurrentStep(index);
    setStepStates(prev => prev.map((state, idx) => {
      if (idx === index) return 'current';
      if (idx < index) return state === 'skipped' ? 'skipped' : 'done';
      if (state === 'done' || state === 'skipped') return state;
      return 'todo';
    }));
  };

  const skipStep = () => {
    setStepStates(prev => prev.map((state, idx) => (idx === currentStep ? 'skipped' : state)));
    toast(`${stepDefs[currentStep].title} skipped`, 'success');
    if (currentStep < stepDefs.length - 1) goToStep(currentStep + 1);
  };

  const handleDeleteDoc = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    toast('File removed', 'success');
  };

  const handleDeleteQC = (name: string) => {
    setQCs(prev => prev.filter(d => d.name !== name));
    toast('File removed', 'success');
  };

  const readSnippet = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['md', 'txt', 'csv', 'json'].includes(ext ?? '')) return undefined;
    return (await file.text()).slice(0, 4000);
  };

  const parseCsvRows = (text: string): QCTestCase[] => {
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    if (!headerLine) return [];
    const headers = headerLine.split(',').map(cell => cell.trim().toLowerCase());
    const get = (cells: string[], names: string[]) => {
      const index = headers.findIndex(header => names.some(name => header.includes(name)));
      return index >= 0 ? cells[index]?.trim() ?? '' : '';
    };
    const normalizeAutomation = (value: string): QCTestCase['automationStatus'] => {
      const normalized = value.trim().toLowerCase();
      return normalized === 'automated' || normalized === 'missing' || normalized === 'unknown' ? normalized : 'unknown';
    };
    return lines.slice(0, 30).map((line, index) => {
      const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      return {
        id: get(cells, ['id', 'case']) || `QC-${String(index + 1).padStart(3, '0')}`,
        feature: get(cells, ['feature', 'module']) || 'Core',
        scenario: get(cells, ['scenario', 'title', 'name']) || cells[0] || `Scenario ${index + 1}`,
        expectedResult: get(cells, ['expected', 'result']) || 'Expected behavior is documented in the QC file.',
        priority: normalizeQCPriority(get(cells, ['priority', 'severity'])),
        automationStatus: normalizeAutomation(get(cells, ['automation', 'automated'])),
      };
    }).filter(row => row.scenario);
  };

  const parseJsonRows = (text: string): QCTestCase[] => {
    const parsed = JSON.parse(text) as unknown;
    const findRows = (value: unknown, depth = 0): unknown[] => {
      if (depth > 3 || !value || typeof value !== 'object') return [];
      if (Array.isArray(value)) return value;
      const object = value as Record<string, unknown>;
      const preferredKeys = ['cases', 'testCases', 'qcCases', 'tests', 'scenarios', 'items', 'requirements'];
      for (const key of preferredKeys) {
        const nested = object[key];
        if (Array.isArray(nested)) return nested;
      }
      for (const nested of Object.values(object)) {
        const rows = findRows(nested, depth + 1);
        if (rows.length) return rows;
      }
      return [];
    };
    const rows = findRows(parsed);
    return rows.slice(0, 30).map((row, index) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id ?? item.caseId ?? `QC-${String(index + 1).padStart(3, '0')}`),
        feature: String(item.feature ?? item.module ?? 'Core'),
        scenario: String(item.scenario ?? item.title ?? item.name ?? `Scenario ${index + 1}`),
        expectedResult: String(item.expectedResult ?? item.expected ?? item.result ?? 'Expected behavior is documented in the QC file.'),
        priority: normalizeQCPriority(String(item.priority ?? item.severity ?? 'Medium')),
        automationStatus: ['automated', 'missing', 'unknown'].includes(String(item.automationStatus ?? item.automated).toLowerCase())
          ? String(item.automationStatus ?? item.automated).toLowerCase() as QCTestCase['automationStatus']
          : 'unknown',
      };
    });
  };

  const parseTextRows = (text: string, fileName: string): QCTestCase[] => {
    const feature = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => /^#{1,4}\s+/.test(line) || /^[-*]\s+/.test(line) || /^[-*]\s+\[[ xX]\]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .slice(0, 20)
      .map((line, index) => {
        const scenario = line
          .replace(/^#{1,4}\s+/, '')
          .replace(/^[-*]\s+\[[ xX]\]\s+/, '')
          .replace(/^[-*]\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .trim();
        return {
          id: `QC-${String(index + 1).padStart(3, '0')}`,
          feature: feature || 'Imported QC',
          scenario: scenario || `Review imported item ${index + 1}`,
          expectedResult: 'Expected behavior is described in the imported QC document.',
          priority: 'Medium' as const,
          automationStatus: 'unknown' as const,
        };
      });
  };

  const fallbackPreviewRow = (file: File): QCTestCase => ({
    id: `QC-${Date.now().toString().slice(-5)}`,
    feature: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Imported QC',
    scenario: `Review imported QC context from ${file.name}`,
    expectedResult: 'Guardrail will use this file as QC context during the initial scan.',
    priority: 'Medium',
    automationStatus: 'unknown',
  });

  const handleDocFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const nextDocs = await Promise.all([...files].map(async file => {
      const snippet = await readSnippet(file);
      return {
        id: `${file.name}-${file.lastModified}`,
        file: toUploadedFile(file, snippet),
        status: 'indexed' as const,
      };
    }));
    setDocs(prev => [...prev, ...nextDocs]);
    toast(`Uploaded ${nextDocs.length} product doc${nextDocs.length > 1 ? 's' : ''}`, 'success');
  };

  const handleQCFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded: UploadedFile[] = [];
    const parsedRows: QCTestCase[] = [];
    for (const file of [...files]) {
      const snippet = await readSnippet(file);
      uploaded.push(toUploadedFile(file, snippet));
      const beforeCount = parsedRows.length;
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'csv' && snippet) parsedRows.push(...parseCsvRows(snippet));
        if (ext === 'json' && snippet) parsedRows.push(...parseJsonRows(snippet));
        if ((ext === 'md' || ext === 'txt') && snippet) parsedRows.push(...parseTextRows(snippet, file.name));
      } catch {
        toast(`Imported ${file.name}, but preview parsing failed`, 'success');
      }
      if (parsedRows.length === beforeCount) {
        parsedRows.push(fallbackPreviewRow(file));
      }
    }
    setQCs(prev => [...prev, ...uploaded]);
    if (parsedRows.length) setQcPreview(prev => [...prev, ...parsedRows]);
    toast(`Imported ${uploaded.length} QC file${uploaded.length > 1 ? 's' : ''}`, 'success');
  };

  const handleAddDocSource = () => {
    const value = docSourceInput.trim();
    if (!value) return;
    setDocSources(prev => [...prev, value]);
    setDocSourceInput('');
  };

  const selectedRepo = repos.find(repo => repo.githubRepoId === selectedGithubRepoId);
  const selectedRepoName = selectedRepo?.fullName ?? repoInfo.fullName;
  const selectedBranch = connectedRepo?.repo.branch ?? selectedRepo?.currentBranch ?? selectedRepo?.defaultBranch ?? repoInfo.branch;
  const selectedRepoIsCloned = Boolean(selectedRepo?.isCloned);
  const normalizedRepoSearch = repoSearch.trim().toLowerCase();
  const visibleRepos = normalizedRepoSearch
    ? repos.filter(repo => {
        const haystack = `${repo.fullName} ${repo.name} ${repo.owner}`.toLowerCase();
        return haystack.includes(normalizedRepoSearch);
      })
    : repos;

  const handleRepoChange = (githubRepoId: string) => {
    const id = Number(githubRepoId);
    if (!Number.isSafeInteger(id)) return;
    setSelectedGithubRepoId(id);
    setConnectedRepo(null);
  };

  const handleConnectRepo = async () => {
    if (!selectedGithubRepoId || connectingRepo) return;
    setConnectingRepo(true);
    try {
      const connected = await connectRepo(selectedGithubRepoId);
      setConnectedRepo(connected);
      toast(connected.reused ? `Using local clone for ${connected.repo.name}` : `Connected ${connected.repo.name}`, 'success');
      goToStep(1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to connect repository', 'success');
    } finally {
      setConnectingRepo(false);
    }
  };

  const finishScan = React.useCallback((result: Awaited<ReturnType<typeof commitOnboardingScan>>) => {
    setScanning(false);
    setScanComplete(true);
    setScanProgress(100);
    setScanStepLabel('Complete');
    setScanEta('done');
    setScanTaskIndex(scanTasks.length);
    setScanSummary(result.summary);
    if (result.logs.length) {
      setScanLogMessages(result.logs.map(log => ({ tag: log.level, message: log.message, at: log.at })));
    }
    setStepStates(prev => prev.map((state, idx) => (idx === 3 ? 'done' : state)));
    toast('Scan complete', 'success');
  }, [toast]);

  const runScanStep = React.useCallback((index: number) => {
    const total = scanTasks.length;
    if (index >= total) {
      setScanProgress(96);
      setScanStepLabel('Generating initial testing insights');
      setScanEta('waiting for scan result');
      return;
    }

    setScanTaskIndex(index);
    setScanProgress(Math.round(((index + 0.5) / total) * 100));
    setScanStepLabel(scanTasks[index].label);
    setScanEta(`~${Math.max(1, total - index)}s remaining`);
    setScanLogMessages(prev => [...prev, { tag: scanTasks[index].warn ? 'warn' : 'info', message: scanTasks[index].label }]);

    scanTimerRef.current = setTimeout(() => runScanStep(index + 1), 620 + Math.random() * 260);
  }, []);

  const buildDraft = (): Partial<OnboardingDraft> => ({
    repository: {
      repo: {
        name: connectedRepo?.repo.name ?? selectedRepo?.name ?? repoInfo.name,
        path: connectedRepo?.repo.path ?? '',
        branch: selectedBranch,
        commit: connectedRepo?.repo.commit,
      },
      detectedStack: [],
      uncommittedChanges: 0,
    },
    productDocs: docs,
    docSources,
    qcFiles: qcs,
    qcPreview,
    commands: {
      packageManager: 'npm',
      test: 'npm test',
      relatedTest: 'npm test -- --runInBand',
      coverage: 'npm run test:coverage',
    },
    scanOptions: {
      runFullSuite: true,
      runCoverage: true,
      runTypecheck: false,
      runLint: false,
      detectFlakyByRerun: false,
      allowTestGeneration: false,
    },
    steps: {
      repository: 'done',
      'product-knowledge': stepStates[1] === 'skipped' ? 'skipped' : 'done',
      'qc-cases': stepStates[2] === 'skipped' ? 'skipped' : 'done',
      commands: 'skipped',
      scan: 'current',
    },
  });

  const startScan = async () => {
    if (scanning) return;
    const repoId = connectedRepo?.repoId ?? (selectedGithubRepoId ? String(selectedGithubRepoId) : null);
    if (!repoId) {
      toast('Connect a repository before scanning', 'success');
      return;
    }
    setScanStarted(true);
    setScanning(true);
    setScanComplete(false);
    setScanTaskIndex(-1);
    setScanLogMessages([]);
    setScanProgress(0);
    setScanSummary(null);
    toast('Scan started', 'loading');
    scanTimerRef.current = setTimeout(() => runScanStep(0), 300);
    try {
      const result = await commitOnboardingScan(repoId, buildDraft());
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      finishScan(result);
    } catch (e) {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      setScanning(false);
      setScanEta('');
      setScanStepLabel('Scan failed');
      toast(e instanceof Error ? e.message : 'Initial scan failed', 'success');
    }
  };

  const resetScan = () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setScanStarted(false);
    setScanning(false);
    setScanComplete(false);
    setScanTaskIndex(-1);
    setScanLogMessages([]);
    setScanProgress(0);
    setScanSummary(null);
    setScanStepLabel('Preparing…');
    setScanEta('');
  };

  const getTaskStatus = (index: number): 'pending' | 'running' | 'done' | 'warn' => {
    if (scanTaskIndex < 0) return 'pending';
    if (index === scanTaskIndex) return 'running';
    if (index < scanTaskIndex) return scanTasks[index].warn ? 'warn' : 'done';
    return 'pending';
  };

  const logTagClass = (tag: string) => {
    if (tag === 'ok') return 'text-[#3ddc97]';
    if (tag === 'warn') return 'text-[#fbbf24]';
    return 'text-[#22d3ee]';
  };

  const logTagSymbol = (tag: string) => (tag === 'ok' ? '✓' : tag === 'warn' ? '!' : '›');
  const scanSummaryStats = scanSummary
    ? [
        { label: 'Automated tests found', value: String(scanSummary.automatedTestsFound), color: '#818cf8' },
        { label: 'QC test cases imported', value: String(scanSummary.qcCasesImported), color: '#22d3ee' },
        { label: 'Product docs indexed', value: String(scanSummary.productDocsIndexed), color: '#60a5fa' },
        { label: 'Missing recommended', value: String(scanSummary.missingRecommended), color: '#60a5fa' },
        { label: 'Suspicious tests', value: String(scanSummary.suspiciousTests), color: '#c084fc' },
        { label: 'Failed tests', value: String(scanSummary.failedTests), color: '#fb7185' },
        { label: 'Flaky tests', value: String(scanSummary.flakyTests), color: '#fbbf24' },
        { label: 'Line coverage', value: `${scanSummary.coverage}%`, color: '#3ddc97' },
      ]
    : [];

  return (
    <div className="min-h-screen" style={{ fontFamily: 'var(--sans)' }}>
      <TopBar
        contentClassName="mx-auto max-w-[1100px]"
        user={user}
        onLogout={() => void logout()}
        actions={
          <>
            <span className="inline-flex items-center gap-[7px] text-[12px] text-[#98a1b3] border border-[rgba(255,255,255,0.07)] bg-[#161a24] px-[11px] py-[5px] rounded-[99px] ml-[4px]">
              <span className="text-[#818cf8]">●</span> First-time setup
            </span>
            <a href="#" className="text-[12.5px] text-[#6b7488] hover:text-[#98a1b3] no-underline" onClick={e => e.preventDefault()}>Docs</a>
            <Button variant="ghost" onClick={() => { toast('Opening dashboard…', 'loading'); setTimeout(() => navigate('/dashboard'), 900); }}>
              Skip & explore
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-[1100px] px-[26px] py-[30px] pb-[60px]">
        <div className="mx-[4px] mb-[26px]">
          <h1 className="text-[27px] font-bold tracking-[-0.6px] text-white mb-[8px]">
            Set up <span className="bg-gradient-to-r from-[#a5acff] to-[#22d3ee] bg-clip-text text-transparent">testing intelligence</span> for your repository
          </h1>
          <p className="text-[14.5px] text-[#98a1b3] m-0 max-w-[720px] leading-[1.55]">
            Connect a GitHub repository, product knowledge, and QC test cases so Guardrail can scan your repo in the cloud and generate testing insights.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[252px_minmax(0,1fr)] gap-[26px] items-start max-w-[1100px] mx-auto">
          <nav className="h-fit lg:sticky lg:top-[80px]">
            <Stepper steps={steps} onStepClick={goToStep} />
          </nav>

          <div className="min-w-0">
            {currentStep === 0 && (
              <Panel className="overflow-hidden p-0">
                <CardHead
                  eyebrow="Step 1 — Repository"
                  title="Select a GitHub repository"
                  description="Choose a repository from your connected GitHub account. Guardrail will clone and analyze it in the cloud."
                />
                <div className="p-[22px]">
                  <div className="flex items-center gap-[14px] p-[16px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[12px] mb-[18px]">
                    <div className="w-[42px] h-[42px] rounded-[10px] flex-none grid place-items-center bg-[rgba(255,255,255,0.06)] text-[#e8ebf2]">
                      <GithubIcon className="w-[22px] h-[22px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10.5px] uppercase tracking-[0.7px] text-[#6b7488] font-bold mb-[3px]">Selected repository</div>
                      <div className="font-mono text-[13px] text-[#e8ebf2] truncate">{selectedRepoName}</div>
                      <div className="text-[12px] text-[#6b7488] mt-[2px]">
                        {connectedRepo
                          ? `Cloned to ${connectedRepo.repo.path}`
                          : selectedRepo?.isCloned
                            ? `Local clone ready at ${selectedRepo.clonePath}`
                            : `${repos.length.toLocaleString()} repositories available from GitHub`}
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => void loadRepos()} disabled={repoLoading}>
                      {repoLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                  </div>

                  {repoError && (
                    <div className="mb-[18px] rounded-[10px] border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] px-[13px] py-[10px] text-[12.5px] text-[#fb7185]">
                      {repoError}
                    </div>
                  )}

                  <div className="mb-[18px]">
                    <div className="flex items-center justify-between gap-[12px] mb-[9px]">
                      <label className="text-[11px] uppercase tracking-[0.6px] text-[#6b7488] font-semibold block">Repository</label>
                      <span className="text-[12px] text-[#6b7488]">
                        {repoLoading ? 'Loading repositories…' : `${visibleRepos.length.toLocaleString()} of ${repos.length.toLocaleString()} repositories`}
                      </span>
                    </div>
                    <SearchInput
                      type="search"
                      placeholder="Search by owner, repo name, or full path…"
                      value={repoSearch}
                      onChange={e => setRepoSearch(e.target.value)}
                      className="mb-[10px]"
                    />
                    <div className="max-h-[272px] overflow-y-auto rounded-[11px] border border-[rgba(255,255,255,0.07)] bg-[#0d0f16]">
                      {repoLoading && (
                        <div className="px-[14px] py-[13px] text-[13px] text-[#98a1b3]">Loading GitHub repositories…</div>
                      )}
                      {!repoLoading && repos.length === 0 && (
                        <div className="px-[14px] py-[13px] text-[13px] text-[#98a1b3]">No repositories available for this GitHub account.</div>
                      )}
                      {!repoLoading && repos.length > 0 && visibleRepos.length === 0 && (
                        <div className="px-[14px] py-[13px] text-[13px] text-[#98a1b3]">No repositories match “{repoSearch}”.</div>
                      )}
                      {!repoLoading && visibleRepos.map(repo => {
                        const selected = repo.githubRepoId === selectedGithubRepoId;
                        return (
                          <button
                            key={repo.githubRepoId}
                            type="button"
                            onClick={() => handleRepoChange(String(repo.githubRepoId))}
                            className={`w-full text-left px-[14px] py-[12px] border-0 border-b border-[rgba(255,255,255,0.07)] last:border-b-0 bg-transparent cursor-pointer transition-colors ${
                              selected ? 'bg-[rgba(129,140,248,0.14)]' : 'hover:bg-[rgba(255,255,255,0.035)]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-[12px]">
                              <div className="min-w-0">
                                <div className="font-mono text-[13px] text-[#e8ebf2] truncate">{repo.fullName}</div>
                                <div className="mt-[4px] flex flex-wrap items-center gap-[8px] text-[11.5px] text-[#6b7488]">
                                  <span>{repo.owner}</span>
                                  <span>·</span>
	                                  <span>{repo.defaultBranch}</span>
	                                  {repo.isCloned && (
	                                    <>
	                                      <span>·</span>
	                                      <span className="text-[#3ddc97]">Cloned locally</span>
	                                    </>
	                                  )}
	                                  {selected && <span className="text-[#818cf8]">Selected</span>}
	                                </div>
	                              </div>
	                              <div className="flex flex-col items-end gap-[6px] flex-none">
	                                {repo.isCloned && (
	                                  <span className="rounded-[999px] px-[8px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.4px] bg-[rgba(61,220,151,0.13)] text-[#3ddc97]">
	                                    Local
	                                  </span>
	                                )}
	                                <span className={`rounded-[999px] px-[8px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.4px] ${
	                                  repo.private
	                                    ? 'bg-[rgba(192,132,252,0.15)] text-[#c084fc]'
	                                    : 'bg-[rgba(96,165,250,0.13)] text-[#60a5fa]'
	                                }`}>
	                                  {repo.private ? 'Private' : 'Public'}
	                                </span>
	                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                    <div className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-[13px_15px]">
                      <div className="text-[11px] uppercase tracking-[0.6px] text-[#6b7488] font-semibold mb-[7px]">Organization</div>
                      <div className="font-mono text-[13.5px] text-[#e8ebf2]">
                        {selectedRepo?.owner ?? repoInfo.fullName.split('/')[0]}
                      </div>
                    </div>
                    <div className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-[13px_15px]">
                      <div className="text-[11px] uppercase tracking-[0.6px] text-[#6b7488] font-semibold mb-[7px]">Branch to scan</div>
                      <div className="font-mono text-[13.5px] text-[#818cf8] flex items-center gap-[8px]">
                        <GitBranchIcon className="w-[14px] h-[14px]" />
                        {selectedBranch}
                      </div>
                    </div>
                  </div>
                </div>
                <StepFoot>
                  <div className="flex-1" />
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleConnectRepo}
                    disabled={!selectedGithubRepoId || repoLoading || connectingRepo}
                  >
                    {connectingRepo ? (selectedRepoIsCloned ? 'Opening…' : 'Cloning…') : selectedRepoIsCloned ? 'Use Local Clone' : 'Connect Repository'}
                    <ChevronRightIcon className="w-[15px] h-[15px]" />
                  </Button>
                </StepFoot>
              </Panel>
            )}

            {currentStep === 1 && (
              <Panel className="overflow-hidden p-0">
                <CardHead
                  eyebrow={<>Step 2 — Product knowledge <span className="text-[#6b7488] border border-[rgba(255,255,255,0.07)] rounded-[5px] px-[6px] py-[1px] normal-case tracking-[0.5px]">Optional</span></>}
                  title="Add product & spec documentation"
                  description={<>Wiki pages, specs, and PRDs tell Guardrail how the product is <em>supposed</em> to behave.</>}
                />
                <div className="p-[22px]">
                  <OptionalBanner>
                    Optional but recommended — <b className="text-[#e8d8fa]">product knowledge helps Guardrail detect tests that are technically passing but wrong according to the product spec.</b>
                  </OptionalBanner>
                  <Dropzone
                    title="Upload Wiki / Specs"
                    subtitle="Drag & drop, or click to browse. Markdown, PDF, Confluence exports, PRDs & API specs."
                    accept=".md · .pdf · .txt"
                    onClick={() => docInputRef.current?.click()}
                  />
                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    accept=".md,.pdf,.txt"
                    className="hidden"
                    onChange={e => { void handleDocFiles(e.target.files); e.currentTarget.value = ''; }}
                  />
                  {docs.length > 0 && (
                    <div className="flex flex-col gap-[9px] mb-[18px]">
                      {docs.map(doc => (
                        <FileRow
                          key={doc.id}
                          name={doc.file.name}
                          type={doc.file.type}
                          size={doc.file.size}
                          status={doc.status === 'indexed' ? 'Indexed' : doc.status}
                          onDelete={() => handleDeleteDoc(doc.id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="text-[12px] font-semibold text-[#98a1b3] mb-[9px]">Or reference a documentation source by name</div>
                  <input
                    className="w-full bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] px-[13px] py-[10px] text-[#e8ebf2] font-mono text-[13px] outline-none focus:border-[rgba(129,140,248,0.35)] focus:shadow-[0_0_0_3px_rgba(129,140,248,0.14)]"
                    placeholder="e.g. Confluence Space: Checkout · /docs/product"
                    value={docSourceInput}
                    onChange={e => setDocSourceInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddDocSource(); }}
                  />
                  {docSources.length > 0 && (
                    <div className="flex flex-wrap gap-[8px] mt-[11px]">
                      {docSources.map((source, i) => (
                        <span key={source} className="inline-flex items-center gap-[7px] text-[12px] font-mono px-[10px] py-[5px] rounded-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] text-[#98a1b3]">
                          <LinkIcon className="w-[12px] h-[12px] opacity-70" />
                          {source}
                          <button type="button" onClick={() => setDocSources(prev => prev.filter((_, j) => j !== i))} className="text-[#6b7488] hover:text-[#fb7185] bg-transparent border-none cursor-pointer p-0">
                            <XIcon strokeWidth={2.2} className="w-[11px] h-[11px]" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <StepFoot>
                  <Button variant="ghost" onClick={() => goToStep(0)}>
                    <ArrowLeftIcon className="w-[15px] h-[15px]" />
                    Back
                  </Button>
                  <div className="flex-1" />
                  <button type="button" onClick={skipStep} className="text-[13px] text-[#6b7488] bg-transparent border-none cursor-pointer px-[8px] py-[9px] hover:text-[#98a1b3] hover:underline">Skip this step</button>
                  <Button variant="primary" size="lg" onClick={() => goToStep(2)}>
                    Continue
                    <ChevronRightIcon className="w-[15px] h-[15px]" />
                  </Button>
                </StepFoot>
              </Panel>
            )}

            {currentStep === 2 && (
              <Panel className="overflow-hidden p-0">
                <CardHead
                  eyebrow={<>Step 3 — Manual QC <span className="text-[#6b7488] border border-[rgba(255,255,255,0.07)] rounded-[5px] px-[6px] py-[1px] normal-case tracking-[0.5px]">Optional</span></>}
                  title="Import QC test cases"
                  description="Bring in your manual test cases so Guardrail can compare what humans verify against what automated tests cover."
                />
                <div className="p-[22px]">
                  <OptionalBanner>
                    <b className="text-[#e8d8fa]">QC test cases help Guardrail find gaps</b> between manual testing and automated coverage.
                  </OptionalBanner>
                  <Dropzone
                    title="Upload QC Test Cases"
                    subtitle="Drag & drop, or click to browse. CSV, spreadsheets, Markdown checklists, JSON."
                    accept=".csv · .xlsx · .md · .json · .txt"
                    onClick={() => qcInputRef.current?.click()}
                  />
                  <input
                    ref={qcInputRef}
                    type="file"
                    multiple
                    accept=".csv,.xlsx,.md,.json,.txt"
                    className="hidden"
                    onChange={e => { void handleQCFiles(e.target.files); e.currentTarget.value = ''; }}
                  />
                  {qcs.length > 0 && (
                    <div className="flex flex-col gap-[9px] mb-[18px]">
                      {qcs.map(qc => (
                        <FileRow key={qc.name} name={qc.name} type={qc.type} size={qc.size} status="Indexed" onDelete={() => handleDeleteQC(qc.name)} />
                      ))}
                    </div>
                  )}
                  <div className="text-[12px] font-semibold text-[#98a1b3] mb-[9px] mt-[4px]">
                    Preview — <span className="font-mono text-[#818cf8]">{qcs[0]?.name ?? 'QC import'}</span> · {qcPreview.length} rows
                  </div>
                  <div className="border border-[rgba(255,255,255,0.07)] rounded-[11px] overflow-hidden mb-[18px]">
                    <table className="w-full border-collapse text-[12.5px]">
                      <thead>
                        <tr className="text-[10.5px] uppercase tracking-[0.5px] text-[#6b7488] font-semibold bg-[#161a24] border-b border-[rgba(255,255,255,0.07)]">
                          <th className="text-left py-[10px] px-[13px]">Test Case ID</th>
                          <th className="text-left py-[10px] px-[13px]">Feature</th>
                          <th className="text-left py-[10px] px-[13px]">Scenario</th>
                          <th className="text-left py-[10px] px-[13px]">Expected Result</th>
                          <th className="text-left py-[10px] px-[13px]">Priority</th>
                          <th className="text-left py-[10px] px-[13px]">Automation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qcPreview.map(row => (
                          <tr key={row.id} className="border-b border-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.018)]">
                            <td className="py-[11px] px-[13px] font-mono text-[12px] text-[#e8ebf2]">{row.id}</td>
                            <td className="py-[11px] px-[13px] text-[#98a1b3]">{row.feature}</td>
                            <td className="py-[11px] px-[13px] text-[#e8ebf2]">{row.scenario}</td>
                            <td className="py-[11px] px-[13px] text-[#98a1b3]">{row.expectedResult}</td>
                            <td className="py-[11px] px-[13px]">
                              <span className={`text-[10.5px] font-bold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-[5px] ${prioClass[row.priority.toLowerCase()]}`}>{row.priority}</span>
                            </td>
                            <td className="py-[11px] px-[13px]">
                              <span className="inline-flex items-center gap-[6px] text-[11.5px] font-medium" style={{ color: autoMeta[row.automationStatus].color }}>
                                <span className="w-[7px] h-[7px] rounded-full" style={{ background: autoMeta[row.automationStatus].color }} />
                                {autoMeta[row.automationStatus].label}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {qcPreview.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-[18px] px-[13px] text-center text-[#6b7488]">
                              Upload a CSV or JSON file to preview imported QC cases.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <StepFoot>
                  <Button variant="ghost" onClick={() => goToStep(1)}>
                    <ArrowLeftIcon className="w-[15px] h-[15px]" />
                    Back
                  </Button>
                  <div className="flex-1" />
                  <button type="button" onClick={skipStep} className="text-[13px] text-[#6b7488] bg-transparent border-none cursor-pointer px-[8px] py-[9px] hover:text-[#98a1b3] hover:underline">Skip this step</button>
                  <Button variant="primary" size="lg" onClick={() => goToStep(3)}>
                    Continue
                    <ChevronRightIcon className="w-[15px] h-[15px]" />
                  </Button>
                </StepFoot>
              </Panel>
            )}

            {currentStep === 3 && !scanComplete && (
              <Panel className="overflow-hidden p-0">
                <CardHead
                  eyebrow="Step 4 — Initial scan"
                  title={scanStarted ? 'Scanning repository…' : 'Run the first repository scan'}
                  description={scanStarted
                    ? 'Scanning your repository in the cloud — building testing intelligence from code, docs, and QC cases.'
                    : 'Guardrail will clone your GitHub repo, detect test commands automatically, and build the dashboard. Here\'s everything it will do:'}
                />
                <div className="p-[22px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[22px] gap-y-[8px] mb-[20px]">
                    {scanTasks.map((task, i) => {
                      const status = getTaskStatus(i);
                      return (
                        <div key={task.label} className="flex items-center gap-[11px] py-[8px] text-[13px]">
                          <div className={`w-[22px] h-[22px] rounded-[7px] flex-none grid place-items-center border transition-all ${
                            status === 'running' ? 'bg-[rgba(129,140,248,0.14)] border-[#818cf8] text-[#818cf8]' :
                            status === 'done' ? 'bg-[rgba(61,220,151,0.13)] border-[rgba(61,220,151,0.5)] text-[#3ddc97]' :
                            status === 'warn' ? 'bg-[rgba(251,191,36,0.14)] border-[rgba(251,191,36,0.5)] text-[#fbbf24]' :
                            'bg-[#0d0f16] border-[rgba(255,255,255,0.12)] text-[#6b7488]'
                          }`}>
                            <ScanTaskStatusIcon status={status} />
                          </div>
                          <span className={`flex-1 ${status === 'pending' ? 'text-[#98a1b3]' : 'text-[#e8ebf2]'}`}>{task.label}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-[0.4px] px-[7px] py-[2px] rounded-[5px] ${
                            status === 'running' ? 'bg-[rgba(129,140,248,0.14)] text-[#818cf8]' :
                            status === 'done' ? 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]' :
                            status === 'warn' ? 'bg-[rgba(251,191,36,0.14)] text-[#fbbf24]' :
                            'text-[#6b7488]'
                          }`}>
                            {status === 'running' ? 'Running' : status === 'done' ? 'Done' : status === 'warn' ? 'Warning' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {scanStarted && (
                    <>
                      <div className="my-[18px]">
                        <div className="flex items-baseline justify-between mb-[9px]">
                          <span className="text-[13px] text-[#e8ebf2] font-medium">
                            {scanStepLabel} <span className="text-[#818cf8] font-mono font-bold">{scanProgress}%</span>
                          </span>
                          <span className="text-[11.5px] text-[#6b7488] font-mono">{scanEta}</span>
                        </div>
                        <ProgressBar value={scanProgress} />
                      </div>
                      <div className="bg-[#07090d] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[14px_16px] max-h-[230px] overflow-y-auto font-mono text-[12.5px] leading-[1.7]">
                        {scanLogMessages.map((log, i) => (
                          <div key={i} className="flex gap-[10px]">
                            <span className="text-[#6b7488] flex-none">{log.at ? new Date(log.at).toTimeString().slice(0, 8) : new Date().toTimeString().slice(0, 8)}</span>
                            <span className="text-[#98a1b3]">
                              <span className={logTagClass(log.tag)}>{logTagSymbol(log.tag)}</span> {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {!scanStarted && (
                  <StepFoot>
                    <Button variant="ghost" onClick={() => goToStep(2)}>
                      <ArrowLeftIcon className="w-[15px] h-[15px]" />
                      Back
                    </Button>
                    <div className="flex-1" />
                    <Button variant="primary" size="lg" onClick={() => void startScan()}>
                      <PlayIcon className="w-[15px] h-[15px]" />
                      Start Initial Scan
                    </Button>
                  </StepFoot>
                )}
                {scanning && (
                  <StepFoot>
                    <Button variant="primary" size="lg" disabled>
                      <span className="w-[16px] h-[16px] rounded-full border-2 border-[rgba(255,255,255,0.4)] border-t-white animate-spin" />
                      Scanning…
                    </Button>
                  </StepFoot>
                )}
              </Panel>
            )}

            {currentStep === 3 && scanComplete && (
              <Panel className="overflow-hidden p-0">
                <div className="px-[22px] pt-[20px] pb-[6px] text-center">
                  <div className="w-[64px] h-[64px] rounded-full mx-auto mb-[16px] grid place-items-center bg-[rgba(61,220,151,0.13)] border-[1.5px] border-[rgba(61,220,151,0.5)] text-[#3ddc97] shadow-[0_0_0_6px_rgba(61,220,151,0.08),0_8px_30px_rgba(61,220,151,0.2)]">
                    <CheckIcon strokeWidth={2.6} className="w-[32px] h-[32px]" />
                  </div>
                  <h2 className="text-[23px] font-bold tracking-[-0.4px] text-white mb-[7px]">Testing intelligence is ready</h2>
                  <p className="text-[13.5px] text-[#98a1b3] m-0 mx-auto max-w-[460px] leading-[1.55]">
                    Guardrail combined your codebase, {scanSummary?.productDocsIndexed ?? 0} product knowledge inputs, and {scanSummary?.qcCasesImported ?? 0} QC cases with scan evidence. Here&apos;s what it found.
                  </p>
                </div>
                <div className="p-[22px]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px] mb-[24px]">
                    {scanSummaryStats.map(stat => (
                      <div key={stat.label} className="bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[14px_15px] relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: stat.color }} />
                        <div className="text-[26px] font-bold tracking-[-0.8px] leading-none" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="text-[11.5px] text-[#98a1b3] mt-[7px] flex items-center gap-[6px]">
                          <span className="w-[7px] h-[7px] rounded-full" style={{ background: stat.color }} />
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-[11px] p-[12px_14px] bg-[rgba(34,211,238,0.05)] border border-[rgba(34,211,238,0.18)] rounded-[11px] text-[12.5px] text-[#98a1b3] leading-[1.5]">
                    <InfoCircleIcon className="w-[16px] h-[16px] flex-shrink-0 text-[#22d3ee] mt-[1px]" />
                    <span>
                      {scanSummary?.missingRecommended ?? 0} missing & {scanSummary?.suspiciousTests ?? 0} suspicious tests are queued as AI insights.
                      Dashboard data was generated from repo scan evidence, product knowledge, QC inputs, and model reasoning when available.
                    </span>
                  </div>
                  {scanLogMessages.length > 0 && (
                    <div className="mt-[14px] bg-[#07090d] border border-[rgba(255,255,255,0.07)] rounded-[11px] p-[12px_14px] max-h-[190px] overflow-y-auto font-mono text-[12px] leading-[1.65]">
                      {scanLogMessages.map((log, i) => (
                        <div key={`${log.message}-${i}`} className="flex gap-[10px]">
                          <span className="text-[#6b7488] flex-none">{log.at ? new Date(log.at).toTimeString().slice(0, 8) : new Date().toTimeString().slice(0, 8)}</span>
                          <span className="text-[#98a1b3]">
                            <span className={logTagClass(log.tag)}>{logTagSymbol(log.tag)}</span> {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <StepFoot>
                  <Button variant="ghost" onClick={resetScan}>
                    <RefreshIcon className="w-[15px] h-[15px]" />
                    Re-run scan
                  </Button>
                  <div className="flex-1" />
                  <Button variant="primary" size="lg" onClick={() => navigate('/dashboard')}>
                    <LayoutDashboardIcon className="w-[15px] h-[15px]" />
                    Open Dashboard
                  </Button>
                </StepFoot>
              </Panel>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
