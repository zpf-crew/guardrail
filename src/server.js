import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { createLogger } from './utils/logger.js';
import { createWeatherService } from './services/weather.js';
import { createMemoryService } from './services/memory.js';
import { createLLMService } from './services/llm.js';
import { createChatService } from './services/chat.js';

import { createHealthRouter } from './routes/health.js';
import { createChatRouter } from './routes/chat.js';
import { createWeatherRouter } from './routes/weather.js';
import { createWebSocketHandler } from './websocket.js';

const logger = createLogger();
const PORT = process.env.PORT || 8080;

async function main() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json());
  app.use(express.static('public'));

  // Services
  const weatherService = createWeatherService();
  const memoryService = createMemoryService();
  const llmService = createLLMService();
  const chatService = createChatService(weatherService, llmService, memoryService);

  // Routes
  app.use('/health', createHealthRouter());
  app.use('/api/chat', createChatRouter(chatService));
  app.use('/api/weather', createWeatherRouter(weatherService));

  // WebSocket
  createWebSocketHandler(io, chatService);

  httpServer.listen(PORT, () => {
    logger.info('Server started', { port: PORT });
  });
}

main().catch((err) => {
  logger.error('Server failed to start', { error: err.message });
  process.exit(1);
});
