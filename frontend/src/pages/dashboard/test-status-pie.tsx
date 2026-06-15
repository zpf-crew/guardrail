import * as React from 'react';
import type { TestCase, TestStatus } from '@/types/testlens';
import { TEST_STATUS_COLOR } from './status-presentation';

const STATUS_ORDER: TestStatus[] = ['passed', 'failed', 'flaky', 'missing', 'suspicious'];
const STATUS_LABEL: Record<TestStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  flaky: 'Flaky',
  missing: 'Missing',
  suspicious: 'Suspicious',
};

const RADIUS = 54;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Donut chart of test-case counts by status, built from the same data the explorer renders. */
export function TestStatusPie({ testCases }: { testCases: TestCase[] }) {
  const { segments, total } = React.useMemo(() => {
    const counts = STATUS_ORDER.map(status => ({
      status,
      count: testCases.filter(tc => tc.status === status).length,
    })).filter(entry => entry.count > 0);
    const sum = counts.reduce((acc, entry) => acc + entry.count, 0);

    let offset = 0;
    const segs = counts.map(entry => {
      const fraction = entry.count / sum;
      const dash = fraction * CIRCUMFERENCE;
      const seg = {
        ...entry,
        dashArray: `${dash} ${CIRCUMFERENCE - dash}`,
        dashOffset: -offset,
        pct: Math.round(fraction * 100),
      };
      offset += dash;
      return seg;
    });
    return { segments: segs, total: sum };
  }, [testCases]);

  if (!total) {
    return (
      <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[14px] p-[18px] text-[13px] text-[#6b7488]">
        No test cases to chart yet.
      </div>
    );
  }

  return (
    <div className="bg-[#11141c] border border-[rgba(255,255,255,0.07)] rounded-[14px] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)] p-[18px]">
      <div className="text-[12px] font-semibold text-[#98a1b3] mb-[14px] uppercase tracking-[0.5px]">Test status breakdown</div>
      <div className="flex items-center gap-[18px]">
        <div className="relative flex-none">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
            {segments.map(seg => (
              <circle
                key={seg.status}
                cx="66"
                cy="66"
                r={RADIUS}
                fill="none"
                stroke={TEST_STATUS_COLOR[seg.status]}
                strokeWidth={STROKE}
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-[24px] font-bold leading-none text-white">{total}</div>
              <div className="text-[10.5px] text-[#6b7488] mt-[3px]">tests</div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-[8px]">
          {segments.map(seg => (
            <div key={seg.status} className="flex items-center gap-[8px] text-[12.5px]">
              <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: TEST_STATUS_COLOR[seg.status] }} />
              <span className="text-[#cbd2e0]">{STATUS_LABEL[seg.status]}</span>
              <span className="ml-auto font-mono text-[#e8ebf2]">{seg.count}</span>
              <span className="font-mono text-[#6b7488] w-[34px] text-right">{seg.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
