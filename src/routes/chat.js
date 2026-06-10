import { Router } from 'express';

export function createChatRouter(chatService) {
  const router = Router();

  router.post('/', async (req, res) => {
    const { message, thread_id } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    try {
      const result = await chatService.processMessage(message, thread_id);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: 'An error occurred while processing your message',
        thread_id: thread_id || null,
      });
    }
  });

  return router;
}
