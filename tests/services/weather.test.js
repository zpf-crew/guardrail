import { describe, it, expect, beforeAll } from 'vitest';
import { createWeatherService } from '../../src/services/weather.js';

describe('createWeatherService', () => {
  let weatherService;

  beforeAll(() => {
    weatherService = createWeatherService();
  });

  it('fetches weather for a valid city', async () => {
    const result = await weatherService.getForecast('London');
    expect(result).toHaveProperty('city');
    expect(result).toHaveProperty('country');
    expect(result).toHaveProperty('latitude');
    expect(result).toHaveProperty('longitude');
    expect(result).toHaveProperty('daily');
    expect(Array.isArray(result.daily)).toBe(true);
    expect(result.daily.length).toBe(7);
    expect(result.daily[0]).toHaveProperty('date');
    expect(result.daily[0]).toHaveProperty('temperatureMax');
    expect(result.daily[0]).toHaveProperty('temperatureMin');
    expect(result.daily[0]).toHaveProperty('precipitationProbability');
    expect(result.daily[0]).toHaveProperty('weatherDescription');
  });

  it('throws for unknown city', async () => {
    await expect(weatherService.getForecast('Xyzabc123')).rejects.toThrow('City not found');
  });
});
