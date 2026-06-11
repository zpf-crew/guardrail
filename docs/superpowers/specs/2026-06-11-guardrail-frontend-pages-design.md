# Guardrail Frontend Pages — Design Spec

**Date:** 2026-06-11
**Topic:** Convert 3 HTML design files into React + Tailwind dummy pages
**Status:** Draft → Approved

---

## 1. Overview

Convert the 3 HTML design files (`TestLens_Onboarding.html`, `TestLens Dashboard.html`, `TestLens_Generate_Tests.html`) into React + TypeScript + Tailwind CSS dummy pages. No backend integration. No real data. Just visual structure + full mock interactions.

### Scope
- **In scope:** 3 new pages (Onboarding, Dashboard, Generate Tests), dark theme, reusable UI components, mock data, routing, full client-side interactivity with hardcoded data.
- **Out of scope:** Backend integration, real auth, real data fetching, business logic, model client, GitHub integration.

---

## 2. Theme & Styling

### 2.1 Design Tokens (CSS Custom Properties)

Add to `frontend/src/styles/globals.css`:

```css
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
```

### 2.2 Global Styles

- Body: `background: var(--bg-grad); background-attachment: fixed; color: var(--text); font-family: var(--sans); font-size: 14px;`
- Selection: `background: rgba(129,140,248,0.35);`
- Scrollbars: custom thin dark scrollbar (10px width, `#2a3142` thumb)
- `::selection` and `::-webkit-scrollbar` rules

### 2.3 Tailwind Integration

- Keep using Tailwind for utility classes.
- Add custom colors via `tailwind.config.ts` that map to the CSS variables for easier Tailwind usage.
- Use arbitrary values `[color:var(--text)]` for one-off custom color needs.

---

## 3. Component Architecture

### 3.1 Reusable UI Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Panel` | `children`, `className` | Card container with bg, border, radius, shadow. Base for all panels. |
| `Badge` | `variant`, `children`, `dot?` | Status/type badge. Variants: `pass`, `fail`, `flaky`, `missing`, `suspicious`, `gray`, `accent`. Optional dot indicator. |
| `Stepper` | `steps`, `activeStep`, `onStepClick` | Vertical step indicator. States: `todo`, `current`, `done`, `skipped`. Connector line between steps. |
| `Button` | `variant`, `size`, `children`, `icon?` | Extended from current. Variants: `primary` (gradient), `default` (panel bg), `ghost` (transparent), `danger` (red). Sizes: `default`, `lg`. |
| `TopBar` | `repo`, `branch`, `scanTime`, `actions` | Sticky header with backdrop blur. Brand logo, repo chips, scan time, action buttons. |
| `Toast` | `message`, `type`, `duration` | Toast notification system. Types: `loading`, `success`. Auto-dismiss. |
| `SearchInput` | `placeholder`, `value`, `onChange`, `shortcut` | Search input with icon, focus ring, optional keyboard shortcut badge. |
| `SegmentedControl` | `options`, `value`, `onChange` | Toggle button group. Active state with panel-3 background. |
| `ProgressBar` | `value`, `max` | Animated progress bar with gradient fill. |
| `FileRow` | `name`, `type`, `size`, `status`, `onDelete` | File list row with type icon, name, size, status, delete button. |
| `CodeDiff` | `diff` | Expandable diff view with add/del/meta line styling. |

### 3.2 Layout Components

| Component | Description |
|-----------|-------------|
| `AppShell` | Updated for dark theme. Sets background, min-height. Wraps all pages. |
| `TopBar` | (listed above, but also a layout concern) |

### 3.3 Page Components

| Page | Route | Steps/Sections |
|------|-------|----------------|
| `OnboardingPage` | `/onboarding` | 4 steps: Repository, Product Knowledge, QC Test Cases, Initial Scan |
| `DashboardPage` | `/dashboard` | Health Summary, Test Case Explorer, Testing Structure, Coverage & Risk, AI Insights |
| `GenerateTestsPage` | `/tests` | 6 steps: Intent, Isolation, Plan, Generate, Run, Review |

---

## 4. Page Designs

### 4.1 Onboarding Page (`/onboarding`)

**Layout:** 3-column grid (stepper left, content center, no right panel).
- **Removed:** Right panel (What TestLens learns + Why all four sources?)
- **Removed:** Test Commands step (auto-detected)
- **Removed:** Detected language & framework badges
- **Removed:** Local-related notes (uncommitted changes, local-only info)

#### Step 1 — Select Repository
- **GitHub repo selector** (dropdown, not local file picker)
- Shows: repo name, current branch
- Continue button → Step 2

#### Step 2 — Product Knowledge (Optional)
- Dropzone for doc uploads
- File list (mock files: `Checkout Flow Spec.pdf`, `Coupon Rules.md`, etc.)
- "Or reference a documentation source by link" input + chips
- Skip / Continue buttons

#### Step 3 — QC Test Cases (Optional)
- Dropzone for QC file uploads
- File list (mock files: `qc-checkout-suite.csv`, etc.)
- Preview table (mock QC rows with ID, Feature, Scenario, Expected, Priority, Automation)
- Skip / Continue buttons

#### Step 4 — Initial Scan
- Scan task list (12 tasks: Analyze repo, Detect framework, Discover tests, Parse docs, Import QC, Map files, Run tests, Run coverage, Detect missing, Detect suspicious, Generate insights)
- Animated progress bar
- Log box with timestamped entries
- On complete: success screen with summary grid (8 stats: tests found, QC imported, docs indexed, missing, suspicious, failed, flaky, coverage)
- "Open Dashboard" button → `/dashboard`

### 4.2 Dashboard Page (`/dashboard`)

**Layout:** Main grid (2 columns: main content left ~1fr, sidebar right ~372px).
- **Removed:** Agent Activity panel from sidebar

#### Header (TopBar)
- Brand: Guardrail + Agent tag
- Repo chips: `checkout-service`, branch `feature/coupon-refactor`
- Scan time: "4 min ago · 2,418 files"
- Actions: "Run Scan", "Generate Tests", "Export Report"

#### Health Summary
- Left: Score card with donut chart (72/100, grade C+), trend, note
- Right: 8 stat tiles (Total, Passed, Failed, Flaky, Missing, Suspicious, Coverage, High-risk)

#### Test Case Explorer
- Toolbar: Search input, group by (Type/Feature/Status), filter dropdowns (Status, Type, Risk, Feature)
- Test list grouped by selected mode
- Each test card: status icon, title, badges (status/type/feature/risk), description, AI note, time, run bars
- Clicking insight highlights related tests

#### Testing Structure
- Module list: path, name, coverage %, test counts by type, coverage bar

#### Coverage & Risk
- Coverage bars by module (line + branch)
- Risk heatmap (modules × issue categories)

#### AI Insights (sidebar)
- Recommendation cards with severity, title, description, action button, meta
- Clicking card highlights related tests in explorer

### 4.3 Generate / Improve Tests Page (`/tests`)

**Layout:** 3-column grid (workflow sidebar left ~218px, main content center, no right context panel).
- **Removed:** Right context panel (Target, Risk summary, Selected test types, Related files, AI questions, Coverage delta)
- **Simplified:** Test types only Unit, UI/Browser, Mobile
- **Removed:** Source context chips (we decide which to use)
- **Moved:** AI questions into main content (Plan step)

#### Workflow Sidebar
- 6 steps: Intent, Isolation, Plan, Generate, Run, Review
- Safety note: "Production code changes require approval."
- Step states: locked, active, done, warn

#### Step 1 — Intent
- Eyebrow: "Step 1 — Intent"
- Large text prompt area: "What testing do you want to improve?"
- Feature/module selector dropdown
- Test type chips: Unit, UI/Browser, Mobile (toggleable)
- **No source context chips**
- Quick actions grid: 5 cards from dashboard insights (e.g., "Generate 4 missing coupon edge-case tests", "Fix 2 suspicious payment tests")
- "Analyze" button → Step 2

#### Step 2 — Isolation & Classification
- Eyebrow: "Step 2 — Isolation & Classification"
- Source & existing tests list (4 mock files)
- Specs & QC cases list (4 mock items)
- Coverage stats: 64% line, 52% branch
- Current test status badges: 1 failed, 1 suspicious, 4 missing
- Detected user journeys text
- Behavior classification grid: 8 cards with status, type, risk, explanation
- "Generate Test Plan" button → Step 3

#### Step 3 — Confirmation & Plan
- Eyebrow: "Step 3 — Confirmation & Plan"
- Proposed actions: Add unit tests (4), Add UI/browser tests (3), Add mobile tests (2), Update suspicious tests (2), Delete outdated tests (1), Run related + coverage
- Risk assessment: 5 rows (Production code changes, Test data changes, Browser automation, Mobile simulator, External API mocking)
- Files likely to change: 5 mock file paths
- **AI Questions** (inline, not in right panel): 3 questions with multiple choice answers
  - Example: "Should expired coupons show a generic error or specific message?"
- Approve bar: Back, Edit Plan, Skip UI Tests, Unit Tests Only, Cancel, Approve Plan

#### Step 4 — Generate Changes
- Eyebrow: "Step 4 — Generate Changes"
- Agent activity timeline (11 tasks with running/done states)
- Change filter bar: All, Add, Update, Delete, Unit, UI/Browser, Mobile
- Change cards: 11 mock changes with title, file, type, feature, risk, reason, expandable diff
- Before/After comparison: 4 items each
- "Run Tests" button → Step 5

#### Step 5 — Run Tests
- Eyebrow: "Step 5 — Run Tests"
- **Unit Tests** run section: command, status, count, duration
- **UI/Browser Tests** run section: command, status, count, duration, visual diff, mock browser frame with screenshot evidence
- **Mobile Tests** run section: command, status, count, duration, mock phone frame with device logs
- Coverage comparison: 4 metrics (line, branch, function, changed-files)
- Test result matrix: 11 rows with test name, type, status, duration, evidence, file
- Flaky test card: Pixel 7 retry timing (with actions: Ask agent to fix, Accept, Revert)
- "Review & Apply" button → Step 6

#### Step 6 — Review & Apply
- Eyebrow: "Step 6 — Review & Apply"
- Recommendation banner: "Recommended: Apply changes. 10 of 11 tests pass..."
- Stats grid: 8 stats (tests added, updated, deleted, passing, coverage deltas, flaky, files changed)
- Files changed: 6 mock files with diff stats
- Remaining risk: 4 rows (Pixel 7 retry, Production code changes, Open questions, Visual baselines)
- Final actions: Revert All, Export Test Plan, Create PR, Apply Changes

---

## 5. Routing

Update `frontend/src/app/router.tsx`:

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/" element={<HomePage />} />
  <Route path="/onboarding" element={<OnboardingPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/tests" element={<GenerateTestsPage />} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

Update `HomePage` to enable navigation cards with `Link` to the new pages.

---

## 6. Mock Data

Each page gets a dedicated mock data file:

| File | Data |
|------|------|
| `data/onboardingMockData.ts` | Repo info, doc files, QC files, QC rows, scan tasks, scan logs, summary stats |
| `data/dashboardMockData.ts` | Test cases (24), insights (6), structure (6 modules), coverage (5 modules), heatmap (5×4), timeline (6 events) |
| `data/generateTestsMockData.ts` | Quick actions (5), classification (8), plan actions (6), plan risk (5), plan files (5), AI questions (3), changes (11), matrix (11), review stats (8), review files (6) |

All data is hardcoded TypeScript objects with full type annotations.

---

## 7. Interactivity

### 7.1 Onboarding
- Stepper click navigation between steps
- File upload simulation (click to add mock files)
- File delete (remove from list)
- Doc source chip add/remove
- Scan start animation (progressive task completion, log entries, progress bar)
- Success screen transition

### 7.2 Dashboard
- Search input with "/" keyboard shortcut
- Filter dropdowns (status, type, risk, feature) with live filtering
- Group by toggle (Type/Feature/Status)
- Clear filters button
- Insight card click → highlight related tests
- Action button click → toast notification
- Test card click → toast notification

### 7.3 Generate Tests
- Workflow sidebar click navigation
- Quick action click → fills prompt
- Test type chip toggle
- Analyze button → simulate loading → go to step 2
- Classification card display
- AI question answer selection
- Plan approval → go to step 3
- Generate animation (timeline progress, progressive change reveal)
- Change card expand/collapse (click to toggle diff)
- Change filter bar
- Run tests animation (progressive suite completion, evidence reveal)
- Coverage bar animation (fill after run)
- Apply changes → toast notification

### 7.4 Toast System
- Global toast container (fixed bottom-center)
- Types: `loading` (with spinner) and `success` (with checkmark)
- Auto-dismiss after 2-2.5 seconds
- Used for all user actions (upload, scan, analyze, approve, apply, etc.)

---

## 8. File Structure

```
frontend/src/
  app/
    App.tsx
    router.tsx              (updated)
    providers.tsx
  components/
    layout/
      AppShell.tsx          (updated for dark theme)
      TopBar.tsx            (new)
    ui/
      button.tsx            (updated)
      card.tsx              (updated)
      panel.tsx             (new)
      badge.tsx             (new)
      stepper.tsx           (new)
      progress-bar.tsx      (new)
      toast.tsx             (new)
      search-input.tsx      (new)
      segmented-control.tsx (new)
      file-row.tsx          (new)
      code-diff.tsx         (new)
  pages/
    LoginPage.tsx
    HomePage.tsx            (updated with navigation links)
    OnboardingPage.tsx      (new)
    DashboardPage.tsx       (new)
    GenerateTestsPage.tsx   (new)
  data/
    onboardingMockData.ts   (new)
    dashboardMockData.ts    (new)
    generateTestsMockData.ts (new)
  styles/
    globals.css             (updated with dark theme)
  lib/
    cn.ts
```

---

## 9. Non-Goals

- **No backend integration:** All data is mock/hardcoded.
- **No real auth:** Pages are accessible without auth (for now).
- **No real data fetching:** No `fetch`, no `axios`, no API calls.
- **No real file upload:** Upload areas are visual only; clicking adds mock files.
- **No real scan:** Scan animation is purely visual with hardcoded log entries.
- **No real test execution:** Run test animation is purely visual.
- **No real code generation:** Diff views are hardcoded strings.
- **No persistence:** No localStorage, no state persistence across reloads.

---

## 10. Accessibility & Responsiveness

- **Responsive:** Layouts collapse to single column on screens < 900px (stepper hides, sidebar hides).
- **Keyboard:** `/` focuses search. Tab navigates interactive elements.
- **Reduced motion:** Respect `prefers-reduced-motion` for animations.
- **Contrast:** All text meets WCAG AA against dark backgrounds.

---

## 11. Next Steps

1. Write implementation plan via `writing-plans` skill.
2. Implement in order: theme → shared components → mock data → pages → routing.
3. Verify compilation and visual fidelity.
