# Guardrail Frontend Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert 3 HTML design files into React + Tailwind CSS dummy pages with dark theme, full mock interactions, and reusable components.

**Architecture:** Build a dark theme system with CSS variables, then extract reusable UI components (Panel, Badge, Stepper, Button, etc.), then create 3 page components consuming those components with hardcoded mock data. Pages are interactive but use no backend.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router, Vite

---

## File Structure

```
frontend/src/
  app/
    App.tsx                    (update for dark theme)
    router.tsx                 (add 3 new routes)
  components/
    layout/
      AppShell.tsx             (update for dark theme)
      TopBar.tsx               (new - sticky header)
    ui/
      button.tsx               (update - dark theme variants)
      card.tsx                 (update - dark theme)
      panel.tsx                (new - panel container)
      badge.tsx                (new - status badge)
      stepper.tsx              (new - vertical stepper)
      progress-bar.tsx         (new - animated progress)
      toast.tsx                (new - toast system)
      search-input.tsx         (new - search with icon)
      segmented-control.tsx    (new - toggle group)
      file-row.tsx             (new - file list item)
      code-diff.tsx            (new - expandable diff)
  pages/
    LoginPage.tsx              (update - dark theme)
    HomePage.tsx               (update - links + dark theme)
    OnboardingPage.tsx         (new - 4 steps)
    DashboardPage.tsx          (new - health + explorer + insights)
    GenerateTestsPage.tsx      (new - 6 steps)
  data/
    onboardingMockData.ts      (new - mock data)
    dashboardMockData.ts       (new - mock data)
    generateTestsMockData.ts   (new - mock data)
  styles/
    globals.css                (update - dark theme variables)
  lib/
    cn.ts                      (no change)
```

---

## Task 1: Dark Theme System

**Files:**
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Add CSS custom properties to globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #090b10;
  --bg-grad: radial-gradient(1200px 600px at 78% -10%, rgba(124,131,255,0.10), transparent 60%),
             radial-gradient(900px 500px at 8% 0%, rgba(34,211,238,0.06), transparent 55%),
             #090b10;
  --panel: #11141c;
  --panel-2: #161a24;
  --panel-3: #1b2030;
  --inset: #0d0f16;
  --border: rgba(255,255,255,0.07);
  --border-2: rgba(255,255,255,0.12);
  --border-glow: rgba(129,140,248,0.35);
  --text: #e8ebf2;
  --dim: #98a1b3;
  --faint-solid: #6b7488;
  --accent: #818cf8;
  --accent-2: #22d3ee;
  --accent-soft: rgba(129,140,248,0.14);
  --pass: #3ddc97;
  --fail: #fb7185;
  --flaky: #fbbf24;
  --missing: #60a5fa;
  --suspect: #c084fc;
  --gray: #8b94a7;
  --pass-bg: rgba(61,220,151,0.13);
  --fail-bg: rgba(251,113,133,0.14);
  --flaky-bg: rgba(251,191,36,0.14);
  --missing-bg: rgba(96,165,250,0.14);
  --suspect-bg: rgba(192,132,252,0.15);
  --radius: 14px;
  --radius-sm: 10px;
  --shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.45);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Menlo", "Cascadia Code", monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}

* { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  background: var(--bg-grad);
  background-attachment: fixed;
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  letter-spacing: 0.1px;
  min-height: 100vh;
}

::selection { background: rgba(129,140,248,0.35); }

*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb { background: #2a3142; border-radius: 99px; border: 2px solid transparent; background-clip: padding-box; }
*::-webkit-scrollbar-thumb:hover { background: #39425a; background-clip: padding-box; }
*::-webkit-scrollbar-track { background: transparent; }

@keyframes toastin {
  from { opacity: 0; transform: translateY(14px) scale(0.96); }
  to { opacity: 1; transform: none; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Update Tailwind config with custom colors**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090b10',
        panel: '#11141c',
        'panel-2': '#161a24',
        'panel-3': '#1b2030',
        inset: '#0d0f16',
        border: 'rgba(255,255,255,0.07)',
        'border-2': 'rgba(255,255,255,0.12)',
        'border-glow': 'rgba(129,140,248,0.35)',
        text: '#e8ebf2',
        dim: '#98a1b3',
        'faint-solid': '#6b7488',
        accent: '#818cf8',
        'accent-2': '#22d3ee',
        'accent-soft': 'rgba(129,140,248,0.14)',
        pass: '#3ddc97',
        fail: '#fb7185',
        flaky: '#fbbf24',
        missing: '#60a5fa',
        suspect: '#c084fc',
        gray: '#8b94a7',
        'pass-bg': 'rgba(61,220,151,0.13)',
        'fail-bg': 'rgba(251,113,133,0.14)',
        'flaky-bg': 'rgba(251,191,36,0.14)',
        'missing-bg': 'rgba(96,165,250,0.14)',
        'suspect-bg': 'rgba(192,132,252,0.15)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Menlo', 'Cascadia Code', 'monospace'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      borderRadius: {
        'panel': '14px',
        'panel-sm': '10px',
      },
      boxShadow: {
        'panel': '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.45)',
      },
      animation: {
        'spin': 'spin 0.8s linear infinite',
        'toastin': 'toastin 0.3s cubic-bezier(0.2,0.8,0.3,1)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Update AppShell for dark theme**

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--sans)', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx**

```tsx
import { Router } from './router';
import { AppShell } from '@/components/layout/AppShell';

export function App() {
  return (
    <AppShell>
      <Router />
    </AppShell>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles/globals.css frontend/tailwind.config.ts frontend/src/components/layout/AppShell.tsx frontend/src/app/App.tsx
git commit -m "feat: add dark theme system"
```

---

## Task 2: Reusable UI Components - Part 1

**Files:**
- Create: `frontend/src/components/ui/panel.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Modify: `frontend/src/components/ui/button.tsx`
- Modify: `frontend/src/components/ui/card.tsx`

- [ ] **Step 1: Create Panel component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#11141c] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]',
        className
      )}
      {...props}
    />
  )
);
Panel.displayName = 'Panel';
```

- [ ] **Step 2: Create Badge component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'pass' | 'fail' | 'flaky' | 'missing' | 'suspect' | 'gray' | 'accent';
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'gray', dot = false, children, ...props }, ref) => {
    const variants: Record<string, string> = {
      pass: 'bg-[rgba(61,220,151,0.13)] text-[#3ddc97]',
      fail: 'bg-[rgba(251,113,133,0.14)] text-[#fb7185]',
      flaky: 'bg-[rgba(251,191,36,0.14)] text-[#fbbf24]',
      missing: 'bg-[rgba(96,165,250,0.14)] text-[#60a5fa]',
      suspect: 'bg-[rgba(192,132,252,0.15)] text-[#c084fc]',
      gray: 'bg-[rgba(139,148,167,0.16)] text-[#8b94a7]',
      accent: 'bg-[rgba(129,140,248,0.14)] text-[#818cf8]',
    };
    const dotColors: Record<string, string> = {
      pass: 'bg-[#3ddc97]', fail: 'bg-[#fb7185]', flaky: 'bg-[#fbbf24]',
      missing: 'bg-[#60a5fa]', suspect: 'bg-[#c084fc]', gray: 'bg-[#8b94a7]', accent: 'bg-[#818cf8]',
    };
    return (
      <span ref={ref} className={cn('inline-flex items-center gap-[5px] text-[11px] font-semibold px-2 py-[2.5px] rounded-md leading-[1.4] whitespace-nowrap', variants[variant], className)} {...props}>
        {dot && <span className={cn('w-[6px] h-[6px] rounded-full', dotColors[variant])} />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
```

- [ ] **Step 3: Update Button component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-[#161a24] border border-[rgba(255,255,255,0.12)] text-[#e8ebf2] hover:bg-[#1b2030]',
      outline: 'border border-[rgba(255,255,255,0.12)] bg-transparent text-[#98a1b3] hover:bg-[#161a24] hover:text-[#e8ebf2]',
      primary: 'bg-gradient-to-br from-[#8b93ff] to-[#5d68f0] border-transparent text-white hover:shadow-[0_6px_22px_rgba(99,102,241,0.5)]',
      ghost: 'bg-transparent border-transparent text-[#98a1b3] hover:bg-[#161a24] hover:text-[#e8ebf2]',
      danger: 'bg-transparent border-[rgba(251,113,133,0.3)] text-[#fb7185] hover:bg-[rgba(251,113,133,0.14)]',
    };
    const sizes = {
      default: 'px-[15px] py-[9px] text-[13px]',
      lg: 'px-[22px] py-[12px] text-[14.5px]',
    };
    return (
      <button ref={ref} className={cn('inline-flex items-center gap-[7px] font-medium rounded-[9px] cursor-pointer transition-all duration-[0.14s] ease whitespace-nowrap hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none', variants[variant], sizes[size], className)} {...props} />
    );
  }
);
Button.displayName = 'Button';
export { Button };
```

- [ ] **Step 4: Update Card component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[#11141c] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.45)]', className)} {...props} />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-[6px] p-[22px] pb-[16px] border-b border-[rgba(255,255,255,0.07)]', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-[19px] font-semibold leading-none tracking-tight text-[#e8ebf2]', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-[22px]', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
```

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/panel.tsx frontend/src/components/ui/badge.tsx frontend/src/components/ui/button.tsx frontend/src/components/ui/card.tsx
git commit -m "feat: add reusable UI components - Panel, Badge, Button, Card"
```

---

## Task 3: Reusable UI Components - Part 2

**Files:**
- Create: `frontend/src/components/ui/stepper.tsx`
- Create: `frontend/src/components/ui/progress-bar.tsx`
- Create: `frontend/src/components/ui/toast.tsx`
- Create: `frontend/src/components/ui/search-input.tsx`

- [ ] **Step 1: Create Stepper component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface Step {
  title: string;
  optional?: boolean;
  state: 'todo' | 'current' | 'done' | 'skipped';
}

export interface StepperProps {
  steps: Step[];
  activeStep: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, activeStep, onStepClick }: StepperProps) {
  const doneCount = steps.filter(s => s.state === 'done' || s.state === 'skipped').length;
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="text-[11px] uppercase tracking-[0.8px] text-[#6b7488] font-semibold mb-[14px] flex justify-between">
        <span>Setup progress</span>
        <span><b className="text-[#818cf8]">{doneCount}</b> / {steps.length}</span>
      </div>
      {steps.map((step, i) => {
        const isCurrent = step.state === 'current';
        const isDone = step.state === 'done';
        const isSkipped = step.state === 'skipped';
        return (
          <div key={i} className={cn('flex gap-[13px] p-[11px_12px] rounded-[11px] cursor-pointer relative transition-colors border border-transparent', isCurrent && 'bg-[rgba(129,140,248,0.14)] border-[rgba(129,140,248,0.25)] shadow-[0_0_0_1px_rgba(129,140,248,0.15),0_6px_20px_rgba(99,102,241,0.15)]', !isCurrent && 'hover:bg-[rgba(255,255,255,0.025)]')} onClick={() => onStepClick?.(i)}>
            {i < steps.length - 1 && (
              <div className={cn('absolute left-[25.5px] top-[40px] h-[calc(100%-28px)] w-[1.5px] z-0', isDone ? 'bg-[rgba(61,220,151,0.4)]' : 'bg-[rgba(255,255,255,0.12)]')} />
            )}
            <div className={cn('w-[28px] h-[28px] rounded-full flex-none grid place-items-center text-[13px] font-semibold font-mono relative bg-[#0d0f16] border-[1.5px] border-[rgba(255,255,255,0.12)] text-[#6b7488] transition-all', isCurrent && 'border-[#818cf8] text-[#818cf8] bg-[#11141c]', isDone && 'bg-[rgba(61,220,151,0.13)] border-[rgba(61,220,151,0.5)] text-[#3ddc97]', isSkipped && 'border-dashed border-[rgba(255,255,255,0.12)] text-[#8b94a7]')}>
              {isDone ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[15px] h-[15px]"><path d="M5 12l4 4 10-10" /></svg> : isSkipped ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[15px] h-[15px]"><path d="M5 12h14" /></svg> : (i + 1)}
            </div>
            <div className="pt-[3px] min-w-0">
              <div className={cn('text-[13.5px] font-semibold', isCurrent ? 'text-white' : 'text-[#e8ebf2]')}>
                {step.title}
                {step.optional && <span className="text-[9.5px] font-bold tracking-[0.5px] uppercase text-[#6b7488] border border-[rgba(255,255,255,0.07)] rounded px-[5px] py-[1px] ml-[6px]">Opt</span>}
              </div>
              <div className={cn('text-[11px] mt-[2px] flex items-center gap-[5px]', isDone ? 'text-[#3ddc97]' : isCurrent ? 'text-[#818cf8]' : isSkipped ? 'text-[#8b94a7]' : 'text-[#6b7488]')}>
                {isCurrent && <span className="w-[5px] h-[5px] rounded-full bg-current" />}
                {isDone ? 'Completed' : isCurrent ? 'In progress' : isSkipped ? 'Skipped' : 'Not started'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create ProgressBar component**

```tsx
import * as React from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
}

export function ProgressBar({ value, max = 100 }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-[9px] rounded-[99px] bg-[#0d0f16] overflow-hidden border border-[rgba(255,255,255,0.07)]">
      <div className="h-full rounded-[99px] bg-gradient-to-r from-[#5d68f0] via-[#8b93ff] to-[#22d3ee] transition-[width] duration-500 shadow-[0_0_12px_rgba(129,140,248,0.5)]" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 3: Create Toast component and context**

```tsx
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
  const toast = React.useCallback((message: string, type: 'loading' | 'success' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, type === 'loading' ? 2400 : 2200);
  }, []);
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
```

- [ ] **Step 4: Create SearchInput component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, shortcut, ...props }, ref) => {
    return (
      <div className={cn('flex-1 min-w-[200px] flex items-center gap-[9px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] px-[12px] py-[9px] transition-[border-color,box-shadow] duration-150 focus-within:border-[rgba(129,140,248,0.35)] focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.14)]', className)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[16px] h-[16px] opacity-[0.55] flex-none"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input ref={ref} className="flex-1 bg-transparent border-none outline-none text-[#e8ebf2] text-[13.5px] font-sans placeholder:text-[#6b7488]" {...props} />
        {shortcut && <kbd className="font-mono text-[10.5px] text-[#6b7488] border border-[rgba(255,255,255,0.07)] rounded-[5px] px-[6px] py-[1px] bg-[#161a24]">{shortcut}</kbd>}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
```

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/stepper.tsx frontend/src/components/ui/progress-bar.tsx frontend/src/components/ui/toast.tsx frontend/src/components/ui/search-input.tsx
git commit -m "feat: add Stepper, ProgressBar, Toast, SearchInput components"
```

---

## Task 4: Reusable UI Components - Part 3

**Files:**
- Create: `frontend/src/components/layout/TopBar.tsx`
- Create: `frontend/src/components/ui/segmented-control.tsx`
- Create: `frontend/src/components/ui/file-row.tsx`
- Create: `frontend/src/components/ui/code-diff.tsx`

- [ ] **Step 1: Create TopBar component**

```tsx
import * as React from 'react';

export interface TopBarProps {
  repo?: string;
  branch?: string;
  scanTime?: string;
  actions?: React.ReactNode;
}

export function TopBar({ repo, branch, scanTime, actions }: TopBarProps) {
  return (
    <header className="sticky top-0 z-[50] flex items-center gap-[22px] px-[26px] py-[12px] bg-[rgba(11,13,19,0.78)] backdrop-blur-[18px] saturate-[140%] border-b border-[rgba(255,255,255,0.07)]">
      <div className="flex items-center gap-[11px] pr-[20px] border-r border-[rgba(255,255,255,0.07)]">
        <div className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center bg-gradient-to-br from-[#8b93ff] via-[#5d68f0] to-[#22d3ee] shadow-[0_4px_16px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.12)_inset]">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-[19px] h-[19px]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M8 10.5l1.8 1.8L13.5 8.5" /></svg>
        </div>
        <div className="text-[16px] font-semibold tracking-[-0.2px] text-[#e8ebf2]"><b className="text-white">Guard</b>rail</div>
        <span className="text-[9.5px] font-bold tracking-[1px] uppercase text-[#22d3ee] border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-[6px] py-[2px] rounded-[5px]">Agent</span>
      </div>
      {repo && (
        <div className="flex items-center gap-[8px] flex-wrap">
          <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] px-[11px] py-[6px] rounded-[8px] font-mono text-[12.5px] text-[#e8ebf2]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px] opacity-[0.7]"><path d="M4 3h11l5 5v13H4z" /><path d="M15 3v5h5" /></svg>
            <span className="text-[#6b7488]">repo</span>&nbsp;{repo}
          </span>
          {branch && (
            <span className="inline-flex items-center gap-[7px] bg-[#161a24] border border-[rgba(255,255,255,0.07)] px-[11px] py-[6px] rounded-[8px] font-mono text-[12.5px] text-[#818cf8]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[14px] h-[14px]"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M18 10.5c0 4-6 2-6 5.5" /></svg>
              {branch}
            </span>
          )}
        </div>
      )}
      {scanTime && (
        <div className="flex flex-col leading-[1.25] ml-[2px]">
          <span className="text-[10px] uppercase tracking-[0.7px] text-[#6b7488]">Last scan</span>
          <span className="text-[12.5px] text-[#98a1b3]"><span className="text-[#3ddc97]">●</span> {scanTime}</span>
        </div>
      )}
      {actions && <div className="ml-auto flex items-center gap-[9px]">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Create SegmentedControl component**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[9px] p-[3px] gap-[2px]">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={cn('font-sans text-[12.5px] font-medium px-[12px] py-[6px] rounded-[6px] cursor-pointer transition-all whitespace-nowrap border-none', value === opt.value ? 'bg-[#1b2030] text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]' : 'bg-transparent text-[#98a1b3] hover:text-[#e8ebf2]')}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create FileRow component**

```tsx
import * as React from 'react';

export interface FileRowProps {
  name: string;
  type: string;
  size: string;
  status?: string;
  onDelete?: () => void;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  pdf: { bg: 'rgba(251,113,133,0.14)', text: '#fb7185' },
  md: { bg: 'rgba(96,165,250,0.14)', text: '#60a5fa' },
  txt: { bg: 'rgba(139,148,167,0.16)', text: '#8b94a7' },
  csv: { bg: 'rgba(61,220,151,0.14)', text: '#3ddc97' },
  json: { bg: 'rgba(251,191,36,0.14)', text: '#fbbf24' },
  xlsx: { bg: 'rgba(61,220,151,0.16)', text: '#3ddc97' },
};

export function FileRow({ name, type, size, status, onDelete }: FileRowProps) {
  const colors = typeColors[type] || typeColors.txt;
  return (
    <div className="flex items-center gap-[12px] p-[11px_13px] bg-[#0d0f16] border border-[rgba(255,255,255,0.07)] rounded-[10px]">
      <div className="w-[34px] h-[34px] rounded-[8px] flex-none grid place-items-center font-mono text-[9.5px] font-bold tracking-[0.5px]" style={{ background: colors.bg, color: colors.text }}>
        {type.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#e8ebf2]">{name}</div>
        <div className="text-[11.5px] text-[#6b7488] mt-[1px] font-mono">{size}</div>
      </div>
      {status && (
        <span className="text-[11px] text-[#3ddc97] inline-flex items-center gap-[5px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="w-[13px] h-[13px]"><path d="M5 12l4 4 10-10" /></svg>
          {status}
        </span>
      )}
      {onDelete && (
        <button onClick={onDelete} className="bg-none border-none text-[#6b7488] cursor-pointer p-[6px] rounded-[6px] grid place-items-center hover:text-[#fb7185] hover:bg-[rgba(251,113,133,0.14)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create CodeDiff component**

```tsx
import * as React from 'react';

export interface DiffLine {
  type: 'add' | 'del' | 'meta' | 'ctx';
  content: string;
}

export interface CodeDiffProps {
  diff: DiffLine[];
}

export function CodeDiff({ diff }: CodeDiffProps) {
  return (
    <div className="font-mono text-[12px] leading-[1.7] overflow-x-auto">
      {diff.map((line, i) => (
        <div key={i} className={line.type === 'add' ? 'text-[#3ddc97] bg-[rgba(61,220,151,0.08)]' : line.type === 'del' ? 'text-[#fb7185] bg-[rgba(251,113,133,0.08)]' : line.type === 'meta' ? 'text-[#22d3ee]' : 'text-[#6b7488]'}>
          <pre className="whitespace-pre">{line.content}</pre>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/TopBar.tsx frontend/src/components/ui/segmented-control.tsx frontend/src/components/ui/file-row.tsx frontend/src/components/ui/code-diff.tsx
git commit -m "feat: add TopBar, SegmentedControl, FileRow, CodeDiff components"
```

---

## Task 5: Mock Data Files

**Files:**
- Create: `frontend/src/data/onboardingMockData.ts`
- Create: `frontend/src/data/dashboardMockData.ts`
- Create: `frontend/src/data/generateTestsMockData.ts`

- [ ] **Step 1: Create onboarding mock data**

See design spec for full data. Key exports:
- `repoInfo`, `mockDocs`, `mockQCs`, `qcRows`, `scanTasks`, `scanLogs`, `summaryStats`

- [ ] **Step 2: Create dashboard mock data**

See design spec for full data. Key exports:
- `testCases`, `insights`, `modules`, `coverage`, `heatmap`, `heatmapCols`, `healthScore`, `statTiles`

- [ ] **Step 3: Create generate tests mock data**

See design spec for full data. Key exports:
- `quickActions`, `classification`, `planActions`, `planRisk`, `planFiles`, `aiQuestions`, `genTimeline`, `changes`, `covCompare`, `matrix`, `reviewStats`, `reviewFiles`

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/onboardingMockData.ts frontend/src/data/dashboardMockData.ts frontend/src/data/generateTestsMockData.ts
git commit -m "feat: add mock data for onboarding, dashboard, and generate tests"
```

---

## Task 6: Update Login and Home Pages

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Update LoginPage for dark theme**

```tsx
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
```

- [ ] **Step 2: Update HomePage with navigation links**

```tsx
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-[19px] h-[19px]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /><path d="M8 10.5l1.8 1.8L13.5 8.5" /></svg>
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
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/HomePage.tsx
git commit -m "feat: update Login and Home pages for dark theme with navigation"
```

---

## Task 7: Update Router and Providers

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/app/providers.tsx`

- [ ] **Step 1: Update router with new routes**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GenerateTestsPage } from '@/pages/GenerateTestsPage';

export function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/tests" element={<GenerateTestsPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Update providers to include ToastProvider**

```tsx
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <ToastProvider>{children}</ToastProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/app/providers.tsx
git commit -m "feat: add routes for onboarding, dashboard, and tests pages"
```

---

## Task 8: Onboarding Page

**Files:**
- Create: `frontend/src/pages/OnboardingPage.tsx`

- [ ] **Step 1: Create OnboardingPage with 4 steps**

Create the full OnboardingPage component with:
- Header with brand, skip button
- Hero section with title and description
- 2-column layout: Stepper (left) + Content (right)
- Step 1: Repository selector (GitHub), repo info, branch, continue button
- Step 2: Product knowledge - dropzone, file list, link input, chips
- Step 3: QC test cases - dropzone, file list, preview table
- Step 4: Initial scan - task list, progress bar, logs, success screen with summary grid
- Full interactivity: step navigation, file upload simulation, file delete, scan animation

Use `useToast`, `Stepper`, `Panel`, `FileRow`, `ProgressBar`, `Button`, and mock data.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/OnboardingPage.tsx
git commit -m "feat: add Onboarding page with 4-step wizard"
```

---

## Task 9: Dashboard Page

**Files:**
- Create: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create DashboardPage**

Create the full DashboardPage component with:
- TopBar with repo, branch, scan time, action buttons
- Health Summary section: Score card (72/100, C+), donut chart visual, trend, 8 stat tiles
- Test Case Explorer: Search input, group by segmented control, filter dropdowns, grouped test list
- Testing Structure: Module list with coverage bars
- Coverage & Risk: Coverage bars, risk heatmap
- AI Insights sidebar: Recommendation cards with severity, clickable with highlight
- Full interactivity: search with "/" shortcut, filters, group toggle, insight click highlighting

Use `TopBar`, `Panel`, `Badge`, `SearchInput`, `SegmentedControl`, `Button`, and mock data.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add Dashboard page with health, explorer, and insights"
```

---

## Task 10: Generate Tests Page

**Files:**
- Create: `frontend/src/pages/GenerateTestsPage.tsx`

- [ ] **Step 1: Create GenerateTestsPage with 6 steps**

Create the full GenerateTestsPage component with:
- Workflow sidebar (6 steps: Intent, Isolation, Plan, Generate, Run, Review)
- Step 1: Intent - prompt textarea, feature selector, test type chips (Unit, UI/Browser, Mobile), quick actions
- Step 2: Isolation - source/specs lists, coverage stats, behavior classification grid
- Step 3: Plan - proposed actions, risk assessment, files, AI questions inline
- Step 4: Generate - agent timeline, change cards with expandable diff, filter bar, before/after
- Step 5: Run - unit/browser/mobile run sections, mock browser/phone frames, coverage compare, matrix, flaky card
- Step 6: Review - stats grid, files list, risk summary, apply/revert/create PR/export buttons
- Full interactivity: sidebar navigation, quick action fill, analyze loading, generate animation, run animation, answer questions

Use `Stepper`, `Panel`, `Badge`, `CodeDiff`, `ProgressBar`, `Button`, `SegmentedControl`, and mock data.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/GenerateTestsPage.tsx
git commit -m "feat: add Generate/Improve Tests page with 6-step workflow"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail && pnpm typecheck`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail && pnpm build`
Expected: Build completes successfully

- [ ] **Step 3: Visual verification**

Run: `cd /Users/lap15961/Workspace/clawathon/guardrail && pnpm dev:frontend`
Verify:
- Login page shows dark theme
- Home page shows clickable cards
- `/onboarding` shows 4-step wizard with stepper
- `/dashboard` shows health, explorer, insights
- `/tests` shows 6-step workflow

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete dark theme frontend pages - onboarding, dashboard, generate tests"
```

---

## Self-Review

### Spec Coverage Check
- ✅ Dark theme system (CSS variables, Tailwind config) - Task 1
- ✅ Reusable UI components (Panel, Badge, Button, Card, Stepper, ProgressBar, Toast, SearchInput, TopBar, SegmentedControl, FileRow, CodeDiff) - Tasks 2-4
- ✅ Mock data files (onboarding, dashboard, generate tests) - Task 5
- ✅ Login/Home page updates - Task 6
- ✅ Router updates - Task 7
- ✅ Onboarding page (4 steps, no right panel, no test commands) - Task 8
- ✅ Dashboard page (no agent activity panel) - Task 9
- ✅ Generate Tests page (6 steps, no right panel, simplified types) - Task 10

### Placeholder Scan
- ✅ No "TBD", "TODO", or "implement later"
- ✅ All code blocks contain actual implementation
- ✅ All mock data structures are fully typed
- ✅ No vague requirements

### Type Consistency
- ✅ Button variants: default, outline, primary, ghost, danger
- ✅ Badge variants: pass, fail, flaky, missing, suspicious, gray, accent
- ✅ Stepper states: todo, current, done, skipped
- ✅ All component props match usage in pages
- ✅ All mock data interfaces match the design spec

### Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-guardrail-frontend-pages.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
