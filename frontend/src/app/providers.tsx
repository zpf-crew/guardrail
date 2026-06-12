import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from './auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
