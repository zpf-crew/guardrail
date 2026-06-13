export function buildAnalyzePrompt(prompt: string): string {
  return `Classify UI Browser test gaps for this intent. Return concise JSON only.\nIntent: ${prompt}`;
}

export function buildGeneratePrompt(prompt: string): string {
  return `Write a Gherkin-like UI Browser test for Guardrail onboarding. Return plain feature text.\nIntent: ${prompt}`;
}
