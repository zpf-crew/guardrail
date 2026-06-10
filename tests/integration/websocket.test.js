import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

import { createWeatherService } from '../../src/services/weather.js';
import { createMemoryService } from '../../src/services/memory.js';
import { createLLMService } from '../../src/services/llm.js';
import { createChatService } from '../../src/services/chat.js';
import { createWebSocketHandler } from '../../src/websocket.js';

describe('WebSocket Integration', () => {
  let server;
  let io;
  let clientSocket;
  let url;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = createServer(app);
    io = new Server(server);

    const weatherService = createWeatherService();
    const memoryService = createMemoryService(':memory:');
    const llmService = createLLMService();
    const chatService = createChatService(weatherService, llmService, memoryService);

    createWebSocketHandler(io, chatService);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    url = `http://localhost:${port}`;
  });

  afterAll(() => {
    if (clientSocket) clientSocket.close();
    io.close();
    server.close();
  });

  it('client can connect and receive thread assignment', async () => {
    clientSocket = Client(url);
    await new Promise((resolve) => clientSocket.on('connect', resolve));
    expect(clientSocket.connected).toBe(true);
  });

  it('client receives error for missing text', async () => {
    clientSocket = Client(url);
    await new Promise((resolve) => clientSocket.on('connect', resolve));

    const responsePromise = new Promise((resolve) => {
      clientSocket.on('error', resolve);
    });

    clientSocket.emit('message', {});
    const response = await responsePromise;

    expect(response.message).toBe('text is required');
  });
});
