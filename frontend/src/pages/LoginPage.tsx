import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ fontFamily: 'var(--sans)' }}>
      <div className="w-full max-w-sm rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#11141c] p-8 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-[11px] mb-6">
          <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.12)_inset]">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-[19px] h-[19px]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M8 10.5l1.8 1.8L13.5 8.5" /></svg>
          </div>
          <h1 className="text-[22px] font-semibold text-[#e8ebf2]"><b className="text-white">Guard</b>rail</h1>
        </div>
        <p className="mb-6 text-[14.5px] text-[#98a1b3] leading-[1.55]">AI testing agent for your repositories.</p>
        <Button variant="primary" className="w-full" onClick={() => navigate('/')}>Continue with GitHub</Button>
      </div>
    </div>
  );
}
