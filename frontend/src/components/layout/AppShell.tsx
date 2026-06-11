export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--sans)', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
