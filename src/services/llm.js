import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export function createLLMService() {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'google/gemma-4-31b-it';
  const baseUrl = process.env.LLM_BASE_URL || 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1';

  async function chat(messages) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('LLM API error', { status: response.status, error: errorText });
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  return { chat };
}
