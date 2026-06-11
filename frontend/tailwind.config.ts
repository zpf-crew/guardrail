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
