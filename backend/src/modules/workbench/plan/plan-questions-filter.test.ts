import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlanQuestions } from './plan-questions-filter.js';
import type { IsolationResult } from '../workbench.types.js';
import type { RepositoryContext } from '../repositories/repository-context-provider.js';

const isolation: IsolationResult = {
  target: { feature: 'Checkout', repo: { name: 'acme', path: '/repo', branch: 'main' } },
  sourceFiles: [{ path: 'src/pages/HomePage.tsx', kind: 'source' }],
  existingTestFiles: [],
  specDocs: [],
  qcCases: [],
  currentCoverage: { line: 0, branch: 0 },
  currentStatus: { failed: 0, suspicious: 0, missing: 1 },
  userJourneys: ['Open HomePage page'],
  classifications: [],
};

const repository: RepositoryContext = {
  repo: { name: 'acme', path: '/repo', branch: 'main' },
  frontend: { route: '/', url: 'http://localhost:5173/' },
  relatedFiles: [],
  specDocs: [],
  qcCases: [],
  sourceSnippets: [{ path: 'src/pages/HomePage.tsx', startLine: 1, endLine: 10, summary: 'Home page', text: 'export default function HomePage() {}' }],
  onboarding: { lastScanAt: null, health: null, coverage: null, testCases: [], insights: [] },
};

test('filterPlanQuestions removes framework and route nonsense', () => {
  const filtered = filterPlanQuestions([
    {
      id: 'framework',
      question: 'What testing environment should be used for UI/Browser tests?',
      options: ['Playwright (real browser)', 'Cypress (real browser)', 'Vitest + React Testing Library (jsdom)'],
    },
    {
      id: 'route',
      question: 'What is the URL/route for the homepage and what is the main App component structure?',
      options: ['Homepage is at root path /', 'Homepage is at /home'],
    },
    {
      id: 'conflict',
      question: 'Spec says coupon auto-applies but QC expects manual apply — which behavior should the test assert?',
      options: ['Auto-apply on cart load', 'Manual apply via button'],
    },
  ], isolation, repository);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'conflict');
});
