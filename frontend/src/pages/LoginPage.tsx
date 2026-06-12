import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BrandIcon } from '@/components/icons';
import { useAuth } from '@/app/auth-context';

export function LoginPage() {
  const { status, login } = useAuth();
  const [params] = useSearchParams();
  const error = params.get('error');

  if (status === 'authenticated') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ fontFamily: 'var(--sans)' }}>
      <div className="w-full max-w-sm rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#11141c] p-8 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-[11px] mb-6">
          <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.12)_inset]">
            <BrandIcon stroke="#fff" className="w-[19px] h-[19px]" />
          </div>
          <h1 className="text-[22px] font-semibold text-[#e8ebf2]"><b className="text-white">Guard</b>rail</h1>
        </div>
        <p className="mb-6 text-[14.5px] text-[#98a1b3] leading-[1.55]">AI testing agent for your repositories.</p>
        {error && (
          <div className="mb-4 rounded-[9px] border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] px-3 py-2 text-[12.5px] text-[#fb7185]">
            GitHub login failed: {error}
          </div>
        )}
        <Button variant="primary" className="w-full" onClick={login} disabled={status === 'loading'}>
          {status === 'loading' ? 'Checking session…' : 'Continue with GitHub'}
        </Button>
      </div>
    </div>
  );
}
