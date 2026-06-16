# Split Frontend Backend Deployment Design

## Goal

Split Guardrail deployment so AgentBase runs only the frontend, while a separate server runs the backend and Postgres together.

## Architecture

The root `Dockerfile` becomes a frontend-only image. It builds `frontend/dist`, serves it with nginx on port `8080`, and writes `/usr/share/nginx/html/runtime-config.js` at container start using `BACKEND_URL` as the API base URL.

The backend gets its own `backend/Dockerfile`. It builds the TypeScript backend, deploys production dependencies, includes `git`, `pnpm`, `yarn`, `agent-browser`, Chromium runtime dependencies, and `guardrail-skills`, then runs database migrations before starting `node dist/server.js`.

`docker-compose.yml` runs `postgres`, `backend`, and Caddy on the backend server. Caddy listens on ports `80` and `443`, provisions HTTPS for `zpf-crew.site`, and forwards requests to the backend service on port `3000`. The backend service connects to Postgres through the Compose network with `DATABASE_URL=postgres://guardrail:guardrail@postgres:5432/guardrail`.

## Components

- `Dockerfile`: frontend AgentBase runtime only.
- `deploy/start-frontend.sh`: validates and writes frontend runtime API configuration, then starts nginx.
- `backend/Dockerfile`: backend runtime with repository and UI-browser tooling.
- `backend/start-backend.sh`: validates required backend environment, runs migrations, and starts the backend API.
- `docker-compose.yml`: backend plus Postgres plus Caddy server deployment.
- `deploy/agentbase.env.example`: frontend-only AgentBase environment example.

## Runtime Flow

1. AgentBase serves the static frontend.
2. Browser requests call `BACKEND_URL`.
3. Backend server handles auth, repository cloning, workbench jobs, model calls, and UI-browser runs.
4. Backend connects to Postgres through `DATABASE_URL`.

## Assumptions

- `BACKEND_URL` is `https://zpf-crew.site`, reachable by users' browsers when the frontend runs on AgentBase.
- GitHub OAuth callback points to the backend URL, not the AgentBase frontend URL.
- Backend deployment secrets are provided by server environment or Compose `.env`.

## Verification

- Build the frontend Docker image target.
- Build the backend Docker image target.
- Run `pnpm --dir frontend build`.
- Run `pnpm --dir backend build`.
