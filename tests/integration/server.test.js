import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';

import { createWeatherService } from '../../src/services/weather.js';
import { createMemoryService } from '../../src/services/memory.js';
import { createLLMService } from '../../src/services/llm.js';
import { createChatService } from '../../src/services/chat.js';
import { createHealthRouter } from '../../src/routes/health.js';
import { createChatRouter } from '../../src/routes/chat.js';
import { createWeatherRouter } from '../../src/routes/weather.js';

describe('HTTP API Integration', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const weatherService = createWeatherService();
    const memoryService = createMemoryService(':memory:');
    const llmService = createLLMService();
    const chatService = createChatService(weatherService, llmService, memoryService);

    app.use('/health', createHealthRouter());
    app.use('/api/chat', createChatRouter(chatService));
    app.use('/api/weather', createWeatherRouter(weatherService));

    server = createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
  });

  afterAll(() => {
    server.close();
  });

  it('GET /health returns 200', async () => {
    const res = await request(server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /api/chat requires message', async () => {
    const res = await request(server).post('/api/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('message is required');
  });

  it('GET /api/weather requires location', async () => {
    const res = await request(server).get('/api/weather');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('location query parameter is required');
  });
});
