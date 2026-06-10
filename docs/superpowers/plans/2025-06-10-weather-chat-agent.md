# Weather Chat Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js weather forecasting chat agent with WebSocket + REST API, SQLite memory, Open-Meteo weather, and GreenNode AIP LLM, packaged as a Docker container for AgentBase deployment.

**Architecture:** Express server with Socket.IO for real-time chat and HTTP endpoints for stateless requests. Four core services (Weather, Memory, LLM, Chat) orchestrate requests. SQLite persists conversation threads. All weather data comes from Open-Meteo (free, no API key). LLM calls go to GreenNode AIP using auto-injected IAM credentials.

**Tech Stack:** Node.js 20, Express, Socket.IO, better-sqlite3, vitest, supertest, socket.io-client

---

## File Structure

```
├── src/
│   ├── server.js              # Express app + Socket.IO attachment
│   ├── routes/
│   │   ├── health.js          # GET /health
│   │   ├── chat.js            # POST /api/chat
│   │   └── weather.js         # GET /api/weather
│   ├── services/
│   │   ├── weather.js         # Open-Meteo API client
│   │   ├── memory.js          # SQLite persistence
│   │   ├── llm.js             # GreenNode AIP client
│   │   └── chat.js            # Chat orchestrator
│   ├── utils/
│   │   ├── weather-codes.js   # WMO code → description mapping
│   │   └── logger.js          # Simple console logger
│   └── websocket.js           # Socket.IO event handlers
├── tests/
│   ├── services/
│   │   ├── weather.test.js
│   │   ├── memory.test.js
│   │   ├── llm.test.js
│   │   └── chat.test.js
│   └── integration/
│       ├── server.test.js
│       └── websocket.test.js
├── data/
│   └── .gitkeep
├── Dockerfile
├── .env.example
├── .dockerignore
└── package.json
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.dockerignore`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "weather-chat-agent",
  "version": "1.0.0",
  "description": "Weather forecasting chat agent for AgentBase",
  "main": "src/server.js",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "express": "^4.19.0",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "socket.io-client": "^4.7.0",
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Create .env.example**

```env
# Optional: override defaults
PORT=8080
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=https://maas-api.vngcloud.vn/v1
WEATHER_API=open-meteo
DB_PATH=./data/chat.db
LOG_LEVEL=info

# DO NOT set these — AgentBase auto-injects them
# GREENNODE_CLIENT_ID=
# GREENNODE_CLIENT_SECRET=
# GREENNODE_AGENT_IDENTITY=
# GREENNODE_ENDPOINT_URL=
```

- [ ] **Step 3: Create .dockerignore**

```
node_modules
data/*.db
coverage
.git
.env
*.log
```

- [ ] **Step 4: Create data/.gitkeep**

```
# Keep this directory in git, but ignore database files
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `node_modules` created with all packages listed in `package.json`.

- [ ] **Step 6: Commit**

```bash
git add package.json .env.example .dockerignore data/.gitkeep
git commit -m "chore: project setup with dependencies"
```

---

## Task 2: Logger Utility

**Files:**
- Create: `src/utils/logger.js`
- Test: `tests/utils/logger.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/utils/logger.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../../src/utils/logger.js';

describe('createLogger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log at info level by default', () => {
    const logger = createLogger();
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('should not log debug when level is info', () => {
    const logger = createLogger('info');
    logger.debug('debug message');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log debug when level is debug', () => {
    const logger = createLogger('debug');
    logger.debug('debug message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('debug message'));
  });

  it('should log errors', () => {
    const logger = createLogger();
    logger.error('error message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('error message'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/logger.test.js`

Expected: FAIL — `Cannot find module '../../src/utils/logger.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/logger.js`:

```javascript
const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(level = process.env.LOG_LEVEL || 'info') {
  const minLevel = LEVELS[level] ?? LEVELS.info;

  function log(levelName, message, meta = {}) {
    const levelValue = LEVELS[levelName] ?? LEVELS.info;
    if (levelValue < minLevel) return;

    const timestamp = new Date().toISOString();
    const logLine = JSON.stringify({
      timestamp,
      level: levelName,
      message,
      ...meta,
    });
    console.log(logLine);
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/logger.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/logger.js tests/utils/logger.test.js
git commit -m "feat: add logger utility with tests"
```

---

## Task 3: Weather Code Utility

**Files:**
- Create: `src/utils/weather-codes.js`
- Test: `tests/utils/weather-codes.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/utils/weather-codes.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { getWeatherDescription } from '../../src/utils/weather-codes.js';

describe('getWeatherDescription', () => {
  it('returns description for known code 0', () => {
    expect(getWeatherDescription(0)).toBe('Clear sky');
  });

  it('returns description for known code 61', () => {
    expect(getWeatherDescription(61)).toBe('Rain');
  });

  it('returns "Unknown" for unknown code', () => {
    expect(getWeatherDescription(999)).toBe('Unknown');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/weather-codes.test.js`

Expected: FAIL — `Cannot find module '../../src/utils/weather-codes.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/weather-codes.js`:

```javascript
const WMO_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export function getWeatherDescription(code) {
  return WMO_CODES[code] ?? 'Unknown';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/weather-codes.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/weather-codes.js tests/utils/weather-codes.test.js
git commit -m "feat: add WMO weather code mapping utility"
```

---

## Task 4: Weather Service

**Files:**
- Create: `src/services/weather.js`
- Test: `tests/services/weather.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/services/weather.test.js`:

```javascript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/weather.test.js`

Expected: FAIL — `Cannot find module '../../src/services/weather.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/services/weather.js`:

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/weather.test.js`

Expected: PASS — Note: these tests make real network calls to Open-Meteo. If the network is unavailable, they will fail. This is acceptable for integration-style service tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/weather.js tests/services/weather.test.js
git commit -m "feat: add weather service with Open-Meteo integration"
```

---

## Task 5: Memory Service

**Files:**
- Create: `src/services/memory.js`
- Test: `tests/services/memory.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/services/memory.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryService } from '../../src/services/memory.js';

describe('createMemoryService', () => {
  let memoryService;

  beforeEach(() => {
    memoryService = createMemoryService(':memory:');
  });

  it('creates a new thread', () => {
    const threadId = memoryService.createThread();
    expect(threadId).toBeDefined();
    expect(typeof threadId).toBe('string');
    expect(threadId.length).toBeGreaterThan(0);
  });

  it('adds and retrieves messages', () => {
    const threadId = memoryService.createThread();
    memoryService.addMessage(threadId, 'user', 'Hello');
    memoryService.addMessage(threadId, 'assistant', 'Hi there');

    const messages = memoryService.getMessages(threadId);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hi there');
  });

  it('returns empty array for unknown thread', () => {
    const messages = memoryService.getMessages('nonexistent');
    expect(messages).toEqual([]);
  });

  it('returns messages ordered by timestamp', () => {
    const threadId = memoryService.createThread();
    memoryService.addMessage(threadId, 'user', 'First');
    memoryService.addMessage(threadId, 'user', 'Second');

    const messages = memoryService.getMessages(threadId);
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/memory.test.js`

Expected: FAIL — `Cannot find module '../../src/services/memory.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/services/memory.js`:

```javascript
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
`;

export function createMemoryService(dbPath = process.env.DB_PATH || './data/chat.db') {
  const db = new Database(dbPath);
  db.exec(SCHEMA);

  const insertThread = db.prepare('INSERT INTO threads (id) VALUES (?)');
  const insertMessage = db.prepare('INSERT INTO messages (thread_id, role, content) VALUES (?, ?, ?)');
  const selectMessages = db.prepare('SELECT role, content, timestamp FROM messages WHERE thread_id = ? ORDER BY timestamp ASC');
  const threadExists = db.prepare('SELECT 1 FROM threads WHERE id = ?');

  function createThread() {
    const id = crypto.randomUUID();
    insertThread.run(id);
    return id;
  }

  function addMessage(threadId, role, content) {
    // Ensure thread exists before adding message
    const exists = threadExists.get(threadId);
    if (!exists) {
      throw new Error(`Thread ${threadId} does not exist`);
    }
    insertMessage.run(threadId, role, content);
  }

  function getMessages(threadId) {
    return selectMessages.all(threadId);
  }

  return {
    createThread,
    addMessage,
    getMessages,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/memory.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/memory.js tests/services/memory.test.js
git commit -m "feat: add memory service with SQLite persistence"
```

---

## Task 6: LLM Service

**Files:**
- Create: `src/services/llm.js`
- Test: `tests/services/llm.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/services/llm.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMService } from '../../src/services/llm.js';

describe('createLLMService', () => {
  const mockEnv = {
    GREENNODE_CLIENT_ID: 'test-client-id',
    GREENNODE_CLIENT_SECRET: 'test-client-secret',
    LLM_MODEL: 'test-model',
    LLM_BASE_URL: 'https://test-api.example.com',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    Object.assign(process.env, mockEnv);
  });

  it('exchanges credentials and calls chat completions', async () => {
    const mockTokenResponse = { access_token: 'mock-token' };
    const mockChatResponse = {
      choices: [{ message: { content: 'Mock response' } }],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockChatResponse,
    });

    const llmService = createLLMService();
    const result = await llmService.chat([
      { role: 'system', content: 'You are a weather assistant' },
      { role: 'user', content: 'Hello' },
    ]);

    expect(result).toBe('Mock response');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws on chat completion error', async () => {
    const mockTokenResponse = { access_token: 'mock-token' };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const llmService = createLLMService();
    await expect(
      llmService.chat([{ role: 'user', content: 'Hello' }])
    ).rejects.toThrow('LLM API error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/llm.test.js`

Expected: FAIL — `Cannot find module '../../src/services/llm.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/services/llm.js`:

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

const TOKEN_URL = 'https://iam.api.vngcloud.vn/v1/oauth2/token';

export function createLLMService() {
  const clientId = process.env.GREENNODE_CLIENT_ID;
  const clientSecret = process.env.GREENNODE_CLIENT_SECRET;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.LLM_BASE_URL || 'https://maas-api.vngcloud.vn/v1';

  async function getAccessToken() {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async function chat(messages) {
    const token = await getAccessToken();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  return { chat };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/llm.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/llm.js tests/services/llm.test.js
git commit -m "feat: add LLM service with GreenNode AIP auth"
```

---

## Task 7: Chat Service

**Files:**
- Create: `src/services/chat.js`
- Test: `tests/services/chat.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/services/chat.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { createChatService } from '../../src/services/chat.js';

describe('createChatService', () => {
  const mockWeatherService = {
    getForecast: vi.fn(),
  };
  const mockLLMService = {
    chat: vi.fn(),
  };
  const mockMemoryService = {
    createThread: vi.fn(),
    addMessage: vi.fn(),
    getMessages: vi.fn(),
  };

  it('processes weather query and returns response', async () => {
    mockWeatherService.getForecast.mockResolvedValue({
      city: 'Hanoi',
      country: 'Vietnam',
      daily: [{ date: '2025-06-11', temperatureMax: 34, temperatureMin: 26, weatherDescription: 'Clear sky' }],
    });
    mockLLMService.chat.mockResolvedValue('The weather in Hanoi is sunny.');
    mockMemoryService.getMessages.mockReturnValue([]);

    const chatService = createChatService(mockWeatherService, mockLLMService, mockMemoryService);
    const result = await chatService.processMessage('What is the weather in Hanoi?', 'thread-1');

    expect(result.response).toBe('The weather in Hanoi is sunny.');
    expect(result.weather).toBeDefined();
    expect(mockMemoryService.addMessage).toHaveBeenCalledTimes(2);
  });

  it('asks for clarification when no city is found', async () => {
    mockLLMService.chat.mockResolvedValue('Which city would you like the weather for?');
    mockMemoryService.getMessages.mockReturnValue([]);

    const chatService = createChatService(mockWeatherService, mockLLMService, mockMemoryService);
    const result = await chatService.processMessage('Tell me about weather', 'thread-1');

    expect(result.response).toBe('Which city would you like the weather for?');
    expect(mockWeatherService.getForecast).not.toHaveBeenCalled();
  });

  it('creates a new thread if threadId is not provided', async () => {
    mockMemoryService.createThread.mockReturnValue('new-thread-id');
    mockWeatherService.getForecast.mockResolvedValue({
      city: 'Paris',
      country: 'France',
      daily: [],
    });
    mockLLMService.chat.mockResolvedValue('It is rainy in Paris.');
    mockMemoryService.getMessages.mockReturnValue([]);

    const chatService = createChatService(mockWeatherService, mockLLMService, mockMemoryService);
    const result = await chatService.processMessage('Weather in Paris');

    expect(result.threadId).toBe('new-thread-id');
    expect(mockMemoryService.createThread).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/chat.test.js`

Expected: FAIL — `Cannot find module '../../src/services/chat.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/services/chat.js`:

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

const SYSTEM_PROMPT = `You are a helpful weather assistant. When the user asks about weather, you receive structured weather data and respond in a friendly, conversational tone. If the user doesn't specify a city, ask them which city they want the forecast for. Keep responses concise.`;

export function createChatService(weatherService, llmService, memoryService) {
  async function processMessage(message, threadId) {
    let currentThreadId = threadId;

    if (!currentThreadId) {
      currentThreadId = memoryService.createThread();
    }

    // Load conversation history
    const history = memoryService.getMessages(currentThreadId);

    // Build messages array for LLM
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // Try to extract city from the message
    let weather = null;
    let city = null;

    // Simple city extraction: look for "in <city>" or "for <city>"
    const match = message.match(/(?:in|for|at)\s+([A-Za-z\s]+)(?:\?|$|\.)/i);
    if (match) {
      city = match[1].trim();
    }

    if (city) {
      try {
        weather = await weatherService.getForecast(city);
        messages.push({
          role: 'system',
          content: `Weather data for ${weather.city}: ${JSON.stringify(weather.daily)}`,
        });
      } catch (err) {
        logger.warn('Weather fetch failed', { error: err.message, city });
      }
    }

    // Call LLM
    let response;
    try {
      response = await llmService.chat(messages);
    } catch (err) {
      logger.error('LLM call failed', { error: err.message });
      response = "I'm having trouble generating a response right now. Please try again later.";
    }

    // Store messages
    memoryService.addMessage(currentThreadId, 'user', message);
    memoryService.addMessage(currentThreadId, 'assistant', response);

    return {
      response,
      weather,
      threadId: currentThreadId,
    };
  }

  return { processMessage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/chat.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/chat.js tests/services/chat.test.js
git commit -m "feat: add chat orchestrator service"
```

---

## Task 8: HTTP Routes

**Files:**
- Create: `src/routes/health.js`
- Create: `src/routes/chat.js`
- Create: `src/routes/weather.js`

- [ ] **Step 1: Write health route**

Create `src/routes/health.js`:

```javascript
import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
}
```

- [ ] **Step 2: Write chat route**

Create `src/routes/chat.js`:

```javascript
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
```

- [ ] **Step 3: Write weather route**

Create `src/routes/weather.js`:

```javascript
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
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/health.js src/routes/chat.js src/routes/weather.js
git commit -m "feat: add HTTP routes for health, chat, and weather"
```

---

## Task 9: WebSocket Handler

**Files:**
- Create: `src/websocket.js`

- [ ] **Step 1: Write WebSocket handler**

Create `src/websocket.js`:

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/websocket.js
git commit -m "feat: add WebSocket handler for real-time chat"
```

---

## Task 10: Express Server

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: Write server setup**

Create `src/server.js`:

```javascript
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
```

- [ ] **Step 2: Verify server starts**

Run: `timeout 5 node src/server.js || true`

Expected: Console output with server started message. The `timeout 5` ensures the process exits after 5 seconds.

- [ ] **Step 3: Commit**

```bash
git add src/server.js
git commit -m "feat: wire up Express server with routes, services, and WebSocket"
```

---

## Task 11: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY data/ ./data/
COPY package.json .

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]
```

- [ ] **Step 2: Build Docker image**

Run: `docker build --platform linux/amd64 -t weather-chat-agent:latest .`

Expected: Image builds successfully. If on Apple Silicon, the `--platform linux/amd64` is required.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile for AgentBase"
```

---

## Task 12: Integration Tests — HTTP API

**Files:**
- Create: `tests/integration/server.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/integration/server.test.js`:

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/server.test.js`

Expected: FAIL — `Cannot find module` or similar.

- [ ] **Step 3: Fix any import issues and run again**

Since all dependencies are already created, the test should pass on the second run.

Run: `npx vitest run tests/integration/server.test.js`

Expected: PASS — all 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/server.test.js
git commit -m "test: add HTTP API integration tests"
```

---

## Task 13: Integration Tests — WebSocket

**Files:**
- Create: `tests/integration/websocket.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/integration/websocket.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/websocket.test.js`

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run tests/integration/websocket.test.js`

Expected: PASS — both WebSocket tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/websocket.test.js
git commit -m "test: add WebSocket integration tests"
```

---

## Task 14: Run All Tests

**Files:**
- None (validation step)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Commit any final changes**

If any files were modified during testing, commit them:

```bash
git add -A && git commit -m "test: full test suite green" || echo "No changes to commit"
```

---

## Task 15: Deployment Validation

**Files:**
- None (validation step)

- [ ] **Step 1: Build Docker image**

Run: `docker build --platform linux/amd64 -t weather-chat-agent:latest .`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run container locally**

Run: `docker run -d --name weather-agent-test -p 8080:8080 weather-chat-agent:latest`

- [ ] **Step 3: Test health endpoint**

Wait 5 seconds for the container to start, then:

Run: `curl -s http://localhost:8080/health`

Expected: `{"status":"ok"}`

- [ ] **Step 4: Test chat endpoint**

Run: `curl -s -X POST http://localhost:8080/api/chat -H "Content-Type: application/json" -d '{"message":"weather in Hanoi"}'`

Expected: JSON response with `response`, `weather`, and `thread_id` fields.

- [ ] **Step 5: Clean up**

Run: `docker stop weather-agent-test && docker rm weather-agent-test`

- [ ] **Step 6: Final commit**

```bash
git commit -m "chore: validate Docker build and local deployment" --allow-empty
```

---

## Spec Coverage Check

| Spec Requirement | Task | Status |
|-----------------|------|--------|
| WebSocket chat (`/ws`) | Task 9 | Implemented |
| REST API chat (`POST /api/chat`) | Task 8 | Implemented |
| Health check (`GET /health`) | Task 8 | Implemented |
| Weather API (`GET /api/weather`) | Task 8 | Implemented |
| Open-Meteo 7-day forecast | Task 4 | Implemented |
| WMO weather code mapping | Task 3 | Implemented |
| GreenNode AIP LLM with IAM auth | Task 6 | Implemented |
| SQLite persistent memory | Task 5 | Implemented |
| Thread/message data model | Task 5 | Implemented |
| Error handling (all scenarios) | Tasks 4-8 | Implemented |
| Dockerfile with port 8080, health check | Task 11 | Implemented |
| Unit tests for all services | Tasks 2-7 | Implemented |
| Integration tests for HTTP + WebSocket | Tasks 12-13 | Implemented |
| Deployment validation | Task 15 | Implemented |

---

## Plan Self-Review

**Placeholder scan:** No TBD, TODO, or vague steps. All code blocks are complete. All test commands are exact. All file paths are exact.

**Type consistency:** All services use `create<ServiceName>` factory functions. All test files import the same module names. Weather service output uses `weatherDescription` consistently.

**No gaps:** All sections from the design spec are covered in the tasks above.

---

**Plan complete and saved to `docs/superpowers/plans/2025-06-10-weather-chat-agent.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you prefer?
