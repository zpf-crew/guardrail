# Guardrail

Guardrail is an AI testing agent for software repositories.

It helps teams understand testing health, find missing or weak tests, detect suspicious tests, and safely generate or improve automated tests.

> Before code changes ship, Guardrail helps prove that the right behavior is tested.

## Current Scaffold Status

This is a hackathon scaffold with a working frontend UI, a Fastify backend, GitHub OAuth + repository clone support, and a **Model Connect** LLM helper. Repository scanning and agent workflows are not implemented yet.

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
  docs/              # Project docs (GitHub auth/repo clone, model-connect)
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
# Edit .env — set GitHub OAuth values for auth/repo clone, and LLM_API_KEY for LLM calls

# 3. Start Postgres with pgvector for local development
docker compose up -d postgres

# 4. Run DB migrations
set -a && source .env && set +a && CI=true pnpm migrate:backend

# 5. In one terminal, run the backend (with env loaded)
set -a && source .env && set +a && CI=true pnpm dev:backend

# 6. In another terminal, run the frontend
VITE_API_BASE_URL=http://localhost:3000 CI=true pnpm dev:frontend
```

Frontend: http://localhost:5173  
Backend: http://localhost:3000

To run the backend and Postgres together in Docker on a backend server:

```bash
docker compose up --build
```

This starts Caddy on ports `80` and `443`, provisions HTTPS for `zpf-crew.site`, and forwards requests to the backend container on port `3000`.

AgentBase should run the root `Dockerfile`, which serves only the frontend and requires `BACKEND_URL=https://zpf-crew.site`.
Set the backend server's `FRONTEND_URL` to the deployed AgentBase frontend origin. The backend uses it for CORS, OAuth redirects, and cross-origin session cookie policy.

## Environment Setup

Copy the example file and fill in values:

```bash
cp .env.example .env
```

The backend reads configuration from `process.env`. Export variables from `.env` before starting the server, or inject them via your IDE / deployment platform.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | For DB features | Postgres connection string |
| `GITHUB_CLIENT_ID` | For OAuth | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | For OAuth | GitHub OAuth app secret |
| `GITHUB_CALLBACK_URL` | For OAuth | OAuth callback URL (`http://localhost:3000/api/auth/github/callback` for local dev, `https://zpf-crew.site/api/auth/github/callback` for Compose/Caddy) |
| `WORKSPACE_DIR` | For repo clone | Local directory where backend stores shallow clones |
| `TOKEN_ENC_KEY` | For OAuth | 32-byte key used to encrypt GitHub tokens at rest |
| `SESSION_TTL_DAYS` | No | Session lifetime in days |
| `LLM_BASE_URL` | For LLM calls | Primary OpenAI-compatible base URL |
| `LLM_API_KEY` | For LLM calls | Primary provider bearer token |
| `LLM_CHAT_PATH` | No | Primary API path after base URL (`messages` for GreenNode, `chat/completions` for OpenAI) |
| `LLM_THINKER_MODEL` | No | Primary thinker profile model (default: `gemma-4`) |
| `LLM_CODER_MODEL` | No | Primary coder profile model (default: `qwen-3.6-coder`) |
| `LLM_FALLBACK_BASE_URL` | No | Fallback provider base URL (used when primary fails) |
| `LLM_FALLBACK_API_KEY` | No | Fallback provider bearer token |
| `LLM_FALLBACK_CHAT_PATH` | No | Fallback API path (defaults to `LLM_CHAT_PATH`) |
| `LLM_FALLBACK_THINKER_MODEL` | No | Fallback thinker model (defaults to `LLM_THINKER_MODEL`) |
| `LLM_FALLBACK_CODER_MODEL` | No | Fallback coder model (defaults to `LLM_CODER_MODEL`) |
| `FRONTEND_URL` | No | Frontend origin for CORS, redirects, and cross-origin cookie policy |
| `BACKEND_URL` | No | Backend public URL used to decide secure session cookie behavior |

**GreenNode (default in `.env.example`):**

```env
LLM_BASE_URL=https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1
LLM_API_KEY=<your-ai-platform-api-key>
LLM_CHAT_PATH=messages
LLM_THINKER_MODEL=gemma-4
LLM_CODER_MODEL=qwen-3.6-coder

# Optional fallback provider
LLM_FALLBACK_BASE_URL=https://api.openai.com/v1
LLM_FALLBACK_API_KEY=<fallback-api-key>
LLM_FALLBACK_CHAT_PATH=chat/completions
LLM_FALLBACK_THINKER_MODEL=gpt-4.1-mini
LLM_FALLBACK_CODER_MODEL=gpt-4.1-mini
```

See [docs/github-auth-repo-clone.md](docs/github-auth-repo-clone.md) for the GitHub OAuth and repository clone modules.

See [docs/model-connect.md](docs/model-connect.md) for how to use the thinker/coder profiles in backend code.

## Current Behavior

- **Frontend:** GitHub login, repo picker, onboarding, dashboard, and generate-tests pages.
- **Backend:** `GET /health`, GitHub OAuth, session auth, repo list, shallow clone, and file-read APIs.
- **Model Connect:** backend helper to call LLM via `modelConnect.getThinker()` / `getCoder()` (not wired to routes yet).

## What Is Intentionally Not Implemented

- Repository scanning
- File browser UI over cloned repositories
- Agent workflows that call Model Connect end-to-end

## Suggested Next Tasks

1. Add file browser UI for cloned repositories
2. Wire scan/agent workflows to Model Connect
3. Add real repository scan and test discovery
4. Add database schema for scans, findings, and insights
5. Replace dashboard/workbench mock data with backend APIs
