import * as React from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'loading' | 'success';
}

interface ToastContextType {
  toast: (message: string, type?: 'loading' | 'success') => void;
}

export const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  React.useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const toast = React.useCallback((message: string, type: 'loading' | 'success' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => { removeToast(id); }, type === 'loading' ? 2400 : 2200);
    timersRef.current.set(id, timer);
  }, [removeToast]);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-[10px] items-center pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-[11px] bg-[#1b2030] border border-[rgba(255,255,255,0.12)] px-[16px] py-[12px] rounded-[11px] shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-[13px] text-[#e8ebf2] min-w-[240px] animate-toastin">
            {t.type === 'loading' ? (
              <span className="w-[16px] h-[16px] rounded-full border-2 border-[rgba(129,140,248,0.3)] border-t-[#818cf8] animate-spin flex-none" />
            ) : (
              <span className="text-[#3ddc97] grid place-items-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[17px] h-[17px]"><path d="M5 12l4 4 10-10" /></svg>
              </span>
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
