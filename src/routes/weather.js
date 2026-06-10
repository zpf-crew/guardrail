import { Router } from 'express';

export function createWeatherRouter(weatherService) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { location } = req.query;

    if (!location || typeof location !== 'string') {
      return res.status(400).json({ error: 'location query parameter is required' });
    }

    try {
      const weather = await weatherService.getForecast(location);
      res.json(weather);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
