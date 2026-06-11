# Guardrail

Guardrail is an AI testing agent for software repositories.

It helps teams understand testing health, find missing or weak tests, detect suspicious tests, and safely generate or improve automated tests.

> Before code changes ship, Guardrail helps prove that the right behavior is tested.

## Current Scaffold Status

This is a hackathon scaffold with a working frontend UI (mock data), a minimal Fastify backend, and a **Model Connect** LLM helper. Auth, repository scanning, and agent workflows are not implemented yet.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + TypeScript + Fastify
- **Database:** PostgreSQL + pgvector (via Docker)
- **LLM:** OpenAI-compatible API (GreenNode MaaS by default)
- **Package Manager:** pnpm

## Folder Structure

```
guardrail/
  frontend/          # React app (Vite + Tailwind)
  backend/           # Fastify API, DB, migrations, model-connect
  docs/              # Project docs (e.g. model-connect guide)
  .env.example
  docker-compose.yml
  package.json
  README.md
```

## How to Run

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment (see below)
cp .env.example .env
# Edit .env — at minimum set LLM_API_KEY for backend LLM calls

# 3. Start Postgres with pgvector
docker compose up -d

# 4. In one terminal, run the frontend
pnpm dev:frontend

# 5. In another terminal, run the backend (with env loaded)
set -a && source .env && set +a && pnpm dev:backend
```

Frontend: http://localhost:5173  
Backend: http://localhost:3000

## Environment Setup

Copy the example file and fill in values:

```bash
cp .env.example .env
```

The backend reads configuration from `process.env`. Export variables from `.env` before starting the server (see step 5 above), or inject them via your IDE / deployment platform.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | For DB features | Postgres connection string |
| `GITHUB_CLIENT_ID` | For OAuth (future) | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | For OAuth (future) | GitHub OAuth app secret |
| `GITHUB_CALLBACK_URL` | For OAuth (future) | OAuth callback URL |
| `LLM_BASE_URL` | For LLM calls | OpenAI-compatible base URL |
| `LLM_API_KEY` | For LLM calls | Bearer token for the LLM provider |
| `LLM_CHAT_PATH` | No | API path after base URL (`messages` for GreenNode, `chat/completions` for OpenAI) |
| `LLM_THINKER_MODEL` | No | Thinker profile model (default: `gemma-4`) |
| `LLM_CODER_MODEL` | No | Coder profile model (default: `qwen-3.6-coder`) |
| `FRONTEND_URL` | No | Frontend origin for CORS / redirects |
| `BACKEND_URL` | No | Backend public URL |

**GreenNode (default in `.env.example`):**

```env
LLM_BASE_URL=https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1
LLM_API_KEY=<your-ai-platform-api-key>
LLM_CHAT_PATH=messages
LLM_THINKER_MODEL=gemma-4
LLM_CODER_MODEL=qwen-3.6-coder
```

See [docs/model-connect.md](docs/model-connect.md) for how to use the thinker/coder profiles in backend code.

## Current Behavior

- **Frontend:** Login, onboarding, dashboard, and generate-tests pages with mock data and design-spec UI.
- **Backend:** `GET /health` → `{ "status": "ok" }`.
- **Model Connect:** backend helper to call LLM via `modelConnect.getThinker()` / `getCoder()` (not wired to routes yet).

## What Is Intentionally Not Implemented

- Real GitHub OAuth
- Repository scanning
- Full database schema (only `pgvector` extension is enabled)
- Auth middleware
- API routes beyond `/health`
- Agent workflows that call Model Connect end-to-end

## Suggested Next Tasks

1. Add real GitHub OAuth
2. Wire scan/agent workflows to Model Connect
3. Add repository picker and onboarding API
4. Add database schema for repos, scans, and insights
5. Connect frontend to backend APIs
