/** Labels shown during the onboarding scan progress animation (not fake API data). */
export interface OnboardingScanTask {
  label: string;
  warn?: boolean;
}

export const onboardingScanTasks: OnboardingScanTask[] = [
  { label: 'Analyze repository structure' },
  { label: 'Detect test framework & commands' },
  { label: 'Discover existing test cases' },
  { label: 'Parse product / wiki documents' },
  { label: 'Import QC test cases' },
  { label: 'Map source files to test files' },
  { label: 'Run test command' },
  { label: 'Run coverage command' },
  { label: 'Detect missing tests', warn: true },
  { label: 'Detect suspicious tests', warn: true },
  { label: 'Generate initial testing insights' },
];
