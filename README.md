# Guardrail

Guardrail is an AI testing agent for software repositories.

It helps teams understand testing health, find missing or weak tests, detect suspicious tests, and safely generate or improve automated tests.

> Before code changes ship, Guardrail helps prove that the right behavior is tested.

## Current Scaffold Status

This is a minimal compile-ready skeleton for hackathon development. No business logic, auth, or agent workflows are implemented yet.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + TypeScript + Fastify
- **Database:** PostgreSQL + pgvector (via Docker)
- **Package Manager:** pnpm

## Folder Structure

```
guardrail/
  frontend/          # React app (Vite + Tailwind)
  backend/           # Fastify API, DB, migrations, infra
  .env.example
  docker-compose.yml
  package.json
  README.md
```

## How to Run

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres with pgvector
docker compose up -d

# 3. In one terminal, run the frontend
pnpm dev:frontend

# 4. In another terminal, run the backend
pnpm dev:backend
```

## Current Behavior

- **Frontend:** opens at `/login`. The "Continue with GitHub" button simply navigates to `/` (no real auth).
- **Home:** empty placeholder shell with disabled cards for Onboarding, Dashboard, and Generate / Improve Tests.
- **Backend:** exposes `GET /health` returning `{ "status": "ok" }`.

## What Is Intentionally Not Implemented

- Real GitHub OAuth
- Repository scanning
- Database schema (only `pgvector` extension is enabled)
- Model client abstraction
- Onboarding, Dashboard, and Generate / Improve Tests pages
- Auth middleware
- API routes beyond `/health`
- Business logic or agent workflows

## Suggested Next Tasks

1. Add real GitHub OAuth
2. Add repository picker
3. Add onboarding page
4. Add dashboard page
5. Add Generate / Improve Tests page
6. Add database schema
7. Add model client abstraction (`thinker` and `coder` profiles)
8. Add scan/agent workflow
