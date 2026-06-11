import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandIcon } from '@/components/icons';

const pages = [
  { title: 'Onboarding', path: '/onboarding', desc: 'Set up your repository for testing intelligence' },
  { title: 'Dashboard', path: '/dashboard', desc: 'View repository health, test cases, and insights' },
  { title: 'Generate / Improve Tests', path: '/tests', desc: 'AI-assisted test generation and improvement' },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl p-8" style={{ fontFamily: 'var(--sans)' }}>
      <div className="flex items-center gap-[11px] mb-6">
        <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4)]">
          <BrandIcon stroke="#fff" className="w-[19px] h-[19px]" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#e8ebf2]"><b className="text-white">Guard</b>rail</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {pages.map(page => (
          <Link key={page.path} to={page.path} className="block no-underline">
            <Card className="transition-all hover:-translate-y-[2px] hover:border-[rgba(129,140,248,0.35)] cursor-pointer">
              <CardHeader>
                <CardTitle className="text-[15px] font-semibold text-[#e8ebf2]">{page.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-[#98a1b3] leading-[1.5]">{page.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
