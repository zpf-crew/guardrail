import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChatService } from '../../src/services/chat.js';

describe('createChatService', () => {
  const mockWeatherService = {
    getForecast: vi.fn(),
  };
  const mockLLMService = {
    chat: vi.fn(),
  };
  const mockMemoryService = {
    createThread: vi.fn(),
    addMessage: vi.fn(),
    getMessages: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes weather query and returns response', async () => {
    mockWeatherService.getForecast.mockResolvedValue({
      city: 'Hanoi',
      country: 'Vietnam',
      daily: [{ date: '2025-06-11', temperatureMax: 34, temperatureMin: 26, weatherDescription: 'Clear sky' }],
    });
    mockLLMService.chat.mockResolvedValue('The weather in Hanoi is sunny.');
    mockMemoryService.getMessages.mockReturnValue([]);

    const chatService = createChatService(mockWeatherService, mockLLMService, mockMemoryService);
    const result = await chatService.processMessage('What is the weather in Hanoi?', 'thread-1');

    expect(result.response).toBe('The weather in Hanoi is sunny.');
    expect(result.weather).toBeDefined();
    expect(mockMemoryService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('asks for clarification when no city is found', async () => {
    mockLLMService.chat.mockResolvedValue('Which city would you like the weather for?');
    mockMemoryService.getMessages.mockReturnValue([]);

    const chatService = createChatService(mockWeatherService, mockLLMService, mockMemoryService);
    const result = await chatService.processMessage('Tell me about weather', 'thread-1');

    expect(result.response).toBe('Which city would you like the weather for?');
    expect(mockWeatherService.getForecast).not.toHaveBeenCalled();
  });

  it('creates a new thread if threadId is not provided', async () => {
    mockMemoryService.createThread.mockReturnValue('new-thread-id');
    mockWeatherService.getForecast.mockResolvedValue({
      city: 'Paris',
      country: 'France',
      daily: [],
    });
    mockLLMService.chat.mockResolvedValue('It is rainy in Paris.');
    mockMemoryService.getMessages.mockReturnValue([]);

    const chatService = createChatService(mockWeatherService, mockLLMService, mockMemoryService);
    const result = await chatService.processMessage('Weather in Paris');

    expect(result.threadId).toBe('new-thread-id');
    expect(mockMemoryService.createThread).toHaveBeenCalled();
  });
});
