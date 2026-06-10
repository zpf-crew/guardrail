import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
}
