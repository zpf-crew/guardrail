import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMService } from '../../src/services/llm.js';

describe('createLLMService', () => {
  const mockEnv = {
    GREENNODE_CLIENT_ID: 'test-client-id',
    GREENNODE_CLIENT_SECRET: 'test-client-secret',
    LLM_MODEL: 'test-model',
    LLM_BASE_URL: 'https://test-api.example.com',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    Object.assign(process.env, mockEnv);
  });

  it('exchanges credentials and calls chat completions', async () => {
    const mockTokenResponse = { access_token: 'mock-token' };
    const mockChatResponse = {
      choices: [{ message: { content: 'Mock response' } }],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChatResponse,
    });

    const llmService = createLLMService();
    const result = await llmService.chat([
      { role: 'system', content: 'You are a weather assistant' },
      { role: 'user', content: 'Hello' },
    ]);

    expect(result).toBe('Mock response');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws on chat completion error', async () => {
    const mockTokenResponse = { access_token: 'mock-token' };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const llmService = createLLMService();
    await expect(
      llmService.chat([{ role: 'user', content: 'Hello' }])
    ).rejects.toThrow('LLM API error');
  });
});
