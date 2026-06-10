import { describe, it, expect } from 'vitest';
import { getWeatherDescription } from '../../src/utils/weather-codes.js';

describe('getWeatherDescription', () => {
  it('returns description for known code 0', () => {
    expect(getWeatherDescription(0)).toBe('Clear sky');
  });

  it('returns description for known code 61', () => {
    expect(getWeatherDescription(61)).toBe('Slight rain');
  });

  it('returns "Unknown" for unknown code', () => {
    expect(getWeatherDescription(999)).toBe('Unknown');
  });
});
