import { createLogger } from '../utils/logger.js';

const logger = createLogger();

const TOKEN_URL = 'https://iam.api.vngcloud.vn/accounts-api/v2/auth/token';

export function createLLMService() {
  const clientId = process.env.GREENNODE_CLIENT_ID;
  const clientSecret = process.env.GREENNODE_CLIENT_SECRET;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.LLM_BASE_URL || 'https://maas-api.vngcloud.vn/v1';

  async function getAccessToken() {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async function chat(messages) {
    const token = await getAccessToken();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  return { chat };
}
