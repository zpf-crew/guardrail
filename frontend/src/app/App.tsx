import { Router } from './router';
import { AppShell } from '@/components/layout/AppShell';

export function App() {
  return (
    <AppShell>
      <Router />
    </AppShell>
  );
}
