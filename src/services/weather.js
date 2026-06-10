import { getWeatherDescription } from '../utils/weather-codes.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export function createWeatherService() {
  async function getForecast(location) {
    // 1. Geocoding
    const geoParams = new URLSearchParams({
      name: location,
      count: '1',
      language: 'en',
      format: 'json',
    });

    const geoResponse = await fetch(`${GEOCODING_URL}?${geoParams}`);
    if (!geoResponse.ok) {
      throw new Error(`Geocoding failed: ${geoResponse.status}`);
    }
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('City not found');
    }

    const place = geoData.results[0];
    const { latitude, longitude, name, country } = place;

    // 2. Forecast
    const forecastParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      timezone: 'auto',
      forecast_days: '7',
    });

    const forecastResponse = await fetch(`${FORECAST_URL}?${forecastParams}`);
    if (!forecastResponse.ok) {
      throw new Error(`Forecast failed: ${forecastResponse.status}`);
    }
    const forecastData = await forecastResponse.json();

    const daily = forecastData.daily.time.map((date, index) => ({
      date,
      temperatureMax: forecastData.daily.temperature_2m_max[index],
      temperatureMin: forecastData.daily.temperature_2m_min[index],
      precipitationProbability: forecastData.daily.precipitation_probability_max[index],
      weatherDescription: getWeatherDescription(forecastData.daily.weather_code[index]),
    }));

    return {
      city: name,
      country: country || '',
      latitude,
      longitude,
      daily,
    };
  }

  return { getForecast };
}
