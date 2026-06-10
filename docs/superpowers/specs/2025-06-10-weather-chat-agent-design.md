# Weather Forecast Chat Agent — Design Document

**Date:** 2025-06-10  
**Status:** Approved  
**Deploy Target:** GreenNode AgentBase (Custom Agent runtime)  

---

## 1. Goal

Build a conversational chat agent that helps users forecast weather for the next 7 days. The agent exposes both a **WebSocket** interface for real-time chat and a **REST API** for stateless integration. It is deployed to GreenNode AgentBase as a Custom Agent (Docker container).

**Success criteria:**
- User can ask for a 7-day weather forecast by city name.
- Agent responds in natural language with a conversational tone.
- Conversation history persists across sessions.
- Container runs on AgentBase, passes health checks, and auto-wires LLM credentials.

---

## 2. Architecture Overview

The agent is a single Node.js container running on AgentBase. It listens on **port 8080** (AgentBase requirement).

### 2.1 Runtime Diagram

```
┌─────────────────────────────────────────────┐
│           AgentBase Runtime Pod             │
│  ┌───────────────────────────────────────┐│
│  │   Node.js Container (port 8080)       ││
│  │                                       ││
│  │  ┌─────────┐  ┌─────────┐  ┌───────┐ ││
│  │  │ Express │  │Socket.IO│  │SQLite │ ││
│  │  │ HTTP    │  │ WebSocket│  │  DB   │ ││
│  │  └────┬────┘  └────┬────┘  └───────┘ ││
│  │       │            │                  ││
  │  │  ┌────┴────────────┴───────────────┐ ││
  │  │  │         Chat Service              │ ││
  │  │  └────┬────────────┬───────────────┘ ││
│  │       │            │                  ││
│  │  ┌────┴────┐  ┌────┴────┐            ││
│  │  │ Weather │  │   LLM   │            ││
│  │  │ Service │  │ Service │            ││
│  │  └────┬────┘  └────┬────┘            ││
│  │       │            │                  ││
│  │  ┌────┴────────────┴───────────────┐ ││
│  │  │   Open-Meteo API   GreenNode AIP │ ││
│  │  └─────────────────────────────────┘ ││
│  └───────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 2.2 Interfaces

| Interface | Protocol | Path | Purpose |
|-----------|----------|------|---------|
| Health check | HTTP | `GET /health` | AgentBase liveness/readiness probe |
| Chat API | HTTP | `POST /api/chat` | Stateless chat request/response |
| Weather API | HTTP | `GET /api/weather` | Direct weather query (optional/debug) |
| Chat Socket | WebSocket | `/ws` | Real-time bidirectional chat |

---

## 3. Components

### 3.1 Component List

| Component | File | Responsibility |
|-----------|------|--------------|
| **HTTP Server** | `src/server.js` | Express app setup, route registration, Socket.IO attachment, error handling middleware |
| **WebSocket Handler** | `src/websocket.js` | Socket.IO connection lifecycle, `thread_id` association, event routing |
| **Chat Service** | `src/services/chat.js` | Orchestrates the full chat flow: intent detection, weather fetch, memory retrieval, LLM prompt construction, response generation |
| **Weather Service** | `src/services/weather.js` | Geocoding and 7-day forecast from Open-Meteo API |
| **LLM Service** | `src/services/llm.js` | Authenticates to GreenNode AIP using auto-injected credentials, calls `/v1/chat/completions` |
| **Memory Service** | `src/services/memory.js` | SQLite CRUD for `threads` and `messages` tables |
| **Health Check** | `src/routes/health.js` | Returns `{"status":"ok"}` with HTTP 200 |

### 3.2 Component Boundaries

Each component communicates through well-defined JavaScript function signatures. No component imports internal details of another.

- **Weather Service** is stateless. Input: `location` (string). Output: `{ city, country, latitude, longitude, daily: [{ date, temperatureMax, temperatureMin, precipitationProbability, weatherDescription }] }`. WMO weather codes are mapped to human-readable strings internally before returning.
- **LLM Service** is stateless. Input: `messages[]` (OpenAI chat format). Output: `responseText` (string).
- **Memory Service** is stateful (SQLite). Input: `threadId`, `role`, `content`. Output: `messages[]` ordered by timestamp.
- **Chat Service** is the only orchestrator. It depends on Weather, LLM, and Memory services. It does NOT expose HTTP or WebSocket directly — that is the server's job.

---

## 4. Data Flow

### 4.1 WebSocket Chat Flow

1. **Client connects** to `wss://<endpoint>/ws`.
2. **Server assigns** `thread_id` (UUID v4) or accepts one from the client query parameter (`?thread_id=abc`).
3. **Client emits** `message` event: `{ "text": "What's the weather in Hanoi next week?", "thread_id": "abc" }`.
4. **Chat Service** processes the message:
   a. Calls **Memory Service** to load all prior messages in `thread_id`.
   b. Parses the user message to extract a location intent. **Mechanism**: The Chat Service scans the user message for weather keywords (e.g., "weather", "forecast", "temperature") and extracts the city name using a simple regex pattern or by asking the LLM to identify the location in a lightweight pre-prompt. If no city is found, the LLM is asked to request clarification from the user.
   c. Calls **Weather Service** to fetch the 7-day forecast for Hanoi.
   d. Constructs an LLM prompt: system instructions + history + current user message + weather JSON.
   e. Calls **LLM Service** with the prompt.
   f. Receives the natural-language response.
5. **Server emits** `response` event: `{ "text": "...", "weather": { ... } }`.
6. **Memory Service** stores both the user message and the assistant response in SQLite.

### 4.2 HTTP Chat Flow

1. **Client POSTs** to `/api/chat` with JSON body: `{ "message": "...", "thread_id": "abc" }`.
2. **Chat Service** executes the same flow as WebSocket (4a–4f above).
3. **Server returns** JSON: `{ "response": "...", "weather": { ... }, "thread_id": "abc" }`.
4. **Memory Service** stores both messages in SQLite.

### 4.3 Weather Service Flow

1. **Geocoding**: Call `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=en&format=json`.
2. **Forecast**: Call `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=7`.
3. **Map WMO weather codes** to human-readable descriptions (e.g., `0` → "Clear sky", `61` → "Rain"). The mapping table is a static JSON object in the Weather Service.
4. **Return structured data** to the Chat Service.

### 4.4 LLM Service Flow

1. **Read** `GREENNODE_CLIENT_ID` and `GREENNODE_CLIENT_SECRET` from environment variables (auto-injected by AgentBase).
2. **Exchange** client credentials for an IAM access token via the GreenNode token endpoint.
3. **Call** `POST https://maas-api.vngcloud.vn/v1/chat/completions` (or the correct AIP base URL) with:
   - `model`: the configured model name (e.g., `gpt-4o-mini` or a GreenNode model).
   - `messages`: the OpenAI chat format array.
   - `temperature`: 0.7.
4. **Return** `choices[0].message.content`.

---

## 5. Data Model

SQLite database file: `data/chat.db` (mounted as a volume if needed, but for single-replica it lives in the container filesystem).

### 5.1 Schema

```sql
CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
```

### 5.2 Data Lifecycle

- **Thread creation**: A new `thread_id` is generated when a user starts a new conversation (no prior `thread_id` provided).
- **Message insertion**: Every user message and assistant response is appended to `messages`.
- **Thread retrieval**: On reconnect or new HTTP request, all messages for a `thread_id` are fetched ordered by `timestamp`.
- **No deletion**: Messages are retained indefinitely (simplest approach). Can add a cleanup cron later if needed.

---

## 6. API Specification

### 6.1 REST Endpoints

#### `GET /health`

- **Purpose**: AgentBase health probe.
- **Response**: `200 OK` with body `{ "status": "ok" }`.
- **Error**: `500` if SQLite is unreachable.

#### `POST /api/chat`

- **Request Body**:
  ```json
  {
    "message": "What's the weather in Hanoi next week?",
    "thread_id": "abc-123"
  }
  ```
  - `message` (string, required): The user's message.
  - `thread_id` (string, optional): If omitted, a new thread is created and returned.

- **Response Body**:
  ```json
  {
    "response": "In Hanoi, the next 7 days will be mostly warm with a chance of rain on Thursday...",
    "weather": {
      "city": "Hanoi",
      "country": "Vietnam",
      "latitude": 21.0245,
      "longitude": 105.8412,
      "daily": [
        {
          "date": "2025-06-11",
          "temperatureMax": 34,
          "temperatureMin": 26,
          "precipitationProbability": 10,
          "weatherDescription": "Clear sky"
        }
      ]
    },
    "thread_id": "abc-123"
  }
  ```

- **Error Response**:
  ```json
  {
    "error": "I couldn't fetch the weather right now. Please try again later.",
    "thread_id": "abc-123"
  }
  ```

#### `GET /api/weather?location=<city>`

- **Purpose**: Direct weather query (for debugging or external use).
- **Response**: Same `weather` object as above.
- **Error**: `400` if location is missing; `502` if Open-Meteo fails.

### 6.2 WebSocket Events (Socket.IO)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `connect` | Client → Server | — | Client opens a WebSocket connection. Optional query: `?thread_id=abc`. |
| `message` | Client → Server | `{ "text": "...", "thread_id": "..." }` | User sends a chat message. |
| `response` | Server → Client | `{ "text": "...", "weather": {...} }` | Assistant's response. |
| `error` | Server → Client | `{ "message": "..." }` | Error occurred during processing. |
| `disconnect` | Either | — | Connection closed. |

---

## 7. Error Handling

| Scenario | Behavior | HTTP Status / WS Event |
|----------|----------|------------------------|
| **Weather API unavailable** | Return a friendly fallback message. Log the error with `console.error`. | `200` with error message in body / `error` event |
| **Weather API returns empty results** (unknown city) | Ask the user to clarify the city name. | `200` / `error` event |
| **LLM API unavailable / times out** | Return a fallback: "I'm having trouble generating a response right now." | `200` / `error` event |
| **LLM API returns invalid JSON** | Catch parsing error, log it, return generic message. | `200` / `error` event |
| **Invalid user input** (missing message) | Return `400` with validation error. | `400` / `error` event |
| **SQLite unavailable** | Health check returns `500`. AgentBase restarts the container. | `500` |
| **WebSocket disconnect mid-stream** | Abort the LLM request if possible. No partial message is stored. | `disconnect` |

---

## 8. Configuration & Environment

### 8.1 Auto-Injected by AgentBase (DO NOT set in `.env`)

| Variable | Description |
|----------|-------------|
| `GREENNODE_CLIENT_ID` | IAM service account ID for platform API auth |
| `GREENNODE_CLIENT_SECRET` | IAM service account secret |
| `GREENNODE_AGENT_IDENTITY` | Registered agent identity on the platform |
| `GREENNODE_ENDPOINT_URL` | Public endpoint URL of this runtime |

### 8.2 User-Provided (optional, passed via `--env-file`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port (must be 8080 for AgentBase) |
| `LLM_MODEL` | `gpt-4o-mini` | Model name for GreenNode AIP chat completions |
| `LLM_BASE_URL` | `https://maas-api.vngcloud.vn/v1` | GreenNode AIP base URL — **verify the exact URL during implementation** as it may vary by region or platform update |
| `WEATHER_API` | `open-meteo` | Weather provider (only `open-meteo` is supported) |
| `DB_PATH` | `./data/chat.db` | SQLite database file path |
| `LOG_LEVEL` | `info` | Console log level (`debug`, `info`, `warn`, `error`) |

---

## 9. Deployment

### 9.1 Dockerfile

- **Base**: `node:20-alpine` (small, secure, compatible with AgentBase).
- **Multi-stage**: Build dependencies in one stage, copy only `node_modules` and `src/` to the final image.
- **Port**: `EXPOSE 8080`.
- **Health check**: `HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD curl -f http://localhost:8080/health || exit 1`. Note: `curl` must be installed in the Alpine image (e.g., `RUN apk add --no-cache curl`).
- **Entrypoint**: `node src/server.js`.

### 9.2 AgentBase Runtime Parameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| **Network mode** | `PUBLIC` | Agent is reachable on the public internet via platform endpoint |
| **Flavor** | `1x1-general` | 1 CPU, 1 GB RAM — sufficient for a lightweight Node.js agent |
| **Min replicas** | `1` | At least one instance always running |
| **Max replicas** | `1` | SQLite is file-based; multiple instances would cause write conflicts. If scaling is needed later, migrate to PostgreSQL and increase max replicas. |
| **CPU scale threshold** | `50%` | Not triggered with max replicas = 1, but included for completeness |
| **Memory scale threshold** | `50%` | Same as above |
| **Registry** | AgentBase managed CR | Integrated with the platform, no external account needed |
| **Env file** | `.env` (if any optional vars are set) | Passed via `--env-file .env` during `runtime.sh create` |

### 9.3 Deployment Steps (Post-Implementation)

1. Build Docker image: `docker build --platform linux/amd64 -t vcr.vngcloud.vn/<repo>/weather-agent:<tag> .`
2. Push to AgentBase CR: `docker push ...`
3. Create runtime via `runtime.sh create` with the parameters above.
4. Wait for `ACTIVE` status.
5. Test health endpoint: `curl <endpoint-url>/health`.
6. Test chat: `curl -X POST <endpoint-url>/api/chat -d '{"message":"weather in Hanoi"}'`.

---

## 10. Testing Strategy

### 10.1 Unit Tests

- **Weather Service**: Mock `fetch` for Open-Meteo. Assert correct URL construction, correct parsing of geocoding and forecast responses, correct weather code mapping.
- **Memory Service**: Use an in-memory SQLite database (`:memory:`). Assert CRUD operations, thread creation, message ordering, and foreign key behavior.
- **LLM Service**: Mock the token exchange and chat completions API. Assert correct headers, correct payload, and correct error handling.
- **Chat Service**: Mock all three services. Assert orchestration flow: weather fetch happens when intent is detected, LLM is called with the right message array, and memory is updated.

### 10.2 Integration Tests

- **HTTP API**: Start the full Express app on a test port. Test `POST /api/chat` with a real SQLite file, mocked weather API, and mocked LLM API. Assert response shape and database state.
- **WebSocket**: Connect a Socket.IO client to the running test server. Emit a `message`, assert the `response` event is received, and assert the database contains both messages.
- **Health check**: Assert `GET /health` returns 200.

### 10.3 Deployment Test

- Build the Docker image locally.
- Run the container with `docker run -p 8080:8080`.
- Send `curl http://localhost:8080/health`.
- Verify the container starts within 10 seconds and health check passes.

### 10.4 Test Runner

- **Framework**: `vitest` (fast, native ESM, good for Node.js).
- **HTTP testing**: `supertest`.
- **WebSocket testing**: `socket.io-client` in test mode.

---

## 11. Security Considerations

- **Credentials**: `GREENNODE_CLIENT_SECRET` is never logged or returned in responses. The LLM Service reads it from `process.env` and uses it only for the token exchange.
- **Input validation**: All user messages are sanitized (no HTML injection). Location strings are URL-encoded before passing to Open-Meteo.
- **No SQL injection**: SQLite queries use parameterized statements (`better-sqlite3` with prepared statements).
- **CORS**: If the REST API is called from a browser, configure Express CORS middleware to allow the specific frontend origin.
- **Rate limiting**: Not implemented in the first version (AgentBase can handle rate limiting at the edge if needed). Can add `express-rate-limit` later.

---

## 12. Future Enhancements (Out of Scope)

- **Multi-language support**: Detect user language and respond in the same language.
- **Location from GPS**: Accept latitude/longitude directly from a mobile app.
- **PostgreSQL migration**: If scaling beyond 1 replica is needed, replace SQLite with PostgreSQL.
- **Caching**: Cache weather results for the same city for 1 hour to reduce API calls.
- **Streaming LLM responses**: Stream the LLM response token-by-token over WebSocket instead of waiting for the full response.

---

## 13. Open Questions (None)

All major questions have been resolved during the brainstorming phase. The design is ready for implementation.

---

**Next Step:** Invoke the `writing-plans` skill to create a detailed implementation plan.
