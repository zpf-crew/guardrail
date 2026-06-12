import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { PlayIcon, WarningTriangleIcon, MonitorIcon } from '@/components/icons';

const PAGE = 'mx-auto max-w-[1640px] p-[24px_26px_70px]';

function Block({ className = '' }: { className?: string }) {
  return <div className={`rounded-[10px] bg-[rgba(255,255,255,0.04)] animate-pulse ${className}`} />;
}

/** Loading skeleton — mirrors the real layout (health row + explorer + side rail). */
export function DashboardSkeleton() {
  return (
    <div className={PAGE}>
      <div className="grid grid-cols-[300px_1fr] gap-[16px] mb-[26px]">
        <Block className="h-[160px]" />
        <div className="grid grid-cols-4 gap-[12px]">
          {Array.from({ length: 8 }).map((_, i) => <Block key={i} className="h-[74px]" />)}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_372px] gap-[24px] items-start">
        <div className="flex flex-col gap-[26px] min-w-0">
          <Block className="h-[420px]" />
          <div className="grid grid-cols-2 gap-[24px]">
            <Block className="h-[260px]" />
            <Block className="h-[260px]" />
          </div>
        </div>
        <div className="flex flex-col gap-[11px]">
          {Array.from({ length: 5 }).map((_, i) => <Block key={i} className="h-[110px]" />)}
        </div>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={PAGE}>
      <Panel className="p-[48px_40px] max-w-[520px] mx-auto mt-[60px] flex flex-col items-center text-center gap-[16px]">
        {children}
      </Panel>
    </div>
  );
}

/** Shown when no scan has run yet for the selected repository. */
export function DashboardEmpty({ onRunScan }: { onRunScan: () => void }) {
  return (
    <CenteredCard>
      <div className="w-[56px] h-[56px] rounded-[14px] grid place-items-center bg-[rgba(129,140,248,0.12)]">
        <MonitorIcon className="w-[26px] h-[26px] text-[#818cf8]" />
      </div>
      <h2 className="text-[18px] font-[650] text-white m-0">No scan yet</h2>
      <p className="text-[13.5px] text-[#98a1b3] leading-[1.55] m-0">
        This repository hasn&apos;t been scanned. Run a scan to analyze testing health, coverage, and missing tests.
      </p>
      <Button variant="primary" onClick={onRunScan}>
        <PlayIcon className="w-[15px] h-[15px]" />
        Run first scan
      </Button>
    </CenteredCard>
  );
}

/** Shown when the dashboard fetch fails. */
export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <CenteredCard>
      <div className="w-[56px] h-[56px] rounded-[14px] grid place-items-center bg-[rgba(251,113,133,0.12)]">
        <WarningTriangleIcon className="w-[26px] h-[26px] text-[#fb7185]" />
      </div>
      <h2 className="text-[18px] font-[650] text-white m-0">Couldn&apos;t load the dashboard</h2>
      <p className="text-[13.5px] text-[#98a1b3] leading-[1.55] m-0 font-mono break-words">{message}</p>
      <Button variant="outline" onClick={onRetry}>Retry</Button>
    </CenteredCard>
  );
}
