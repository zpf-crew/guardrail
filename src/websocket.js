import { createLogger } from './utils/logger.js';

const logger = createLogger();

export function createWebSocketHandler(io, chatService) {
  io.on('connection', (socket) => {
    const threadId = socket.handshake.query.thread_id || null;
    logger.info('Client connected', { socketId: socket.id, threadId });

    socket.on('message', async (data) => {
      try {
        const { text, thread_id } = data;
        if (!text || typeof text !== 'string') {
          socket.emit('error', { message: 'text is required' });
          return;
        }

        const result = await chatService.processMessage(text, thread_id || threadId);
        socket.emit('response', {
          text: result.response,
          weather: result.weather,
          thread_id: result.threadId,
        });
      } catch (err) {
        logger.error('WebSocket message error', { error: err.message });
        socket.emit('error', { message: 'An error occurred while processing your message' });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
}
