import { createLogger } from '../utils/logger.js';

const logger = createLogger();

const SYSTEM_PROMPT = `You are a helpful weather assistant. When the user asks about weather, you receive structured weather data and respond in a friendly, conversational tone. If the user doesn't specify a city, ask them which city they want the forecast for. Keep responses concise.`;

export function createChatService(weatherService, llmService, memoryService) {
  async function processMessage(message, threadId) {
    let currentThreadId = threadId;

    if (!currentThreadId) {
      currentThreadId = memoryService.createThread();
    }

    // Load conversation history
    const history = memoryService.getMessages(currentThreadId);

    // Build messages array for LLM
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // Try to extract city from the message
    let weather = null;
    let city = null;

    // Simple city extraction: look for "in <city>" or "for <city>"
    const match = message.match(/(?:in|for|at)\s+([A-Za-z\s]+)(?:\?|$|\.)/i);
    if (match) {
      city = match[1].trim();
    }

    if (city) {
      try {
        weather = await weatherService.getForecast(city);
        messages.push({
          role: 'system',
          content: `Weather data for ${weather.city}: ${JSON.stringify(weather.daily)}`,
        });
      } catch (err) {
        logger.warn('Weather fetch failed', { error: err.message, city });
      }
    }

    // Call LLM
    let response;
    try {
      response = await llmService.chat(messages);
    } catch (err) {
      logger.error('LLM call failed', { error: err.message });
      response = "I'm having trouble generating a response right now. Please try again later.";
    }

    // Store messages
    memoryService.addMessage(currentThreadId, 'user', message);
    memoryService.addMessage(currentThreadId, 'assistant', response);

    return {
      response,
      weather,
      threadId: currentThreadId,
    };
  }

  return { processMessage };
}
