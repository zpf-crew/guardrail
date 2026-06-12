# GitHub Auth and Repository Clone

This document explains the local GitHub OAuth, repository listing, shallow clone,
and file-read foundation used by Guardrail.

The feature scope is intentionally narrow for the hackathon:

- Real GitHub login.
- List repositories from the authenticated GitHub account.
- Clone a selected repository with `git clone --depth 1`.
- Read cloned repository files through backend APIs.
- Keep dashboard, scan, and test-generation intelligence mocked for now.

## Architecture

```text
Frontend
  LoginPage
    -> GET /api/auth/github

Backend
  /api/auth/github
    -> creates OAuth state in Postgres
    -> redirects to github.com/login/oauth/authorize

  /api/auth/github/callback
    -> verifies OAuth state
    -> exchanges code for GitHub access token
    -> fetches GitHub user
    -> upserts user
    -> encrypts and stores GitHub token
    -> creates session row
    -> sets HttpOnly gr_session cookie
    -> redirects to /onboarding

Frontend
  AuthProvider
    -> GET /api/auth/me
    -> authenticated routes render if gr_session is valid

  OnboardingPage
    -> GET /api/repos
    -> POST /api/repos/:githubRepoId/connect

Backend
  /api/repos
    -> decrypts GitHub token
    -> calls GitHub /user/repos
    -> returns first 100 repos

  /api/repos/:githubRepoId/connect
    -> verifies GitHub repo access
    -> upserts repo row
    -> shallow clones repo to WORKSPACE_DIR
    -> stores clone path, branch, commit
    -> returns RepoRef

  /api/repos/:repoId/files
  /api/repos/:repoId/file?path=...
    -> reads from local clone after tenant/path checks
```

## Backend Modules

### Database

Files:

- `backend/src/plugins/db.ts`
- `backend/src/db/migrate.ts`
- `backend/db/migrations/001_auth_repos.sql`

Responsibilities:

- Creates a shared `pg.Pool` and decorates Fastify as `app.db`.
- Runs SQL migrations with `pnpm migrate:backend`.
- Creates core tables:
  - `users`
  - `github_tokens`
  - `sessions`
  - `oauth_states`
  - `repos`
  - `schema_migrations`

Migration execution is explicit. Server startup does not auto-run migrations.

### Auth

Files:

- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.repository.ts`
- `backend/src/modules/auth/github-oauth.service.ts`
- `backend/src/modules/auth/session.service.ts`
- `backend/src/modules/auth/token-crypto.ts`
- `backend/src/modules/auth/auth.types.ts`

Responsibilities:

- Builds the GitHub OAuth authorize URL.
- Stores and consumes OAuth `state` values for CSRF protection.
- Exchanges callback `code` for a GitHub access token.
- Fetches GitHub user profile.
- Stores users and encrypted GitHub tokens in Postgres.
- Creates and validates `gr_session` cookies.
- Provides `requireAuth` for protected routes.

Security notes:

- The GitHub token is stored encrypted at rest with AES-256-GCM.
- `TOKEN_ENC_KEY` must be 32 bytes, 64 hex chars, or base64-encoded 32 bytes.
- The browser never receives the GitHub token.
- The browser only receives an HttpOnly `gr_session` cookie.

### Repositories

Files:

- `backend/src/modules/repos/repos.routes.ts`
- `backend/src/modules/repos/repos.repository.ts`
- `backend/src/modules/repos/github-api.service.ts`
- `backend/src/modules/repos/git-clone.service.ts`
- `backend/src/modules/repos/repo-files.service.ts`
- `backend/src/modules/repos/repos.types.ts`

Responsibilities:

- Lists GitHub repositories for the logged-in user.
- Clones a selected repository with `git clone --depth 1`.
- Stores clone metadata in `repos`.
- Enforces that `repoId` belongs to the current session user.
- Lists directories and reads text files from the local clone.
- Rejects path traversal outside the clone root.

Clone location:

```text
<backend cwd>/<WORKSPACE_DIR>/<userId>/<repoId>
```

With the current local default, this is:

```text
backend/.guardrail-workspaces/<userId>/<repoId>
```

If you want clone storage at the repository root, set:

```env
WORKSPACE_DIR=../.guardrail-workspaces
```

Then restart the backend.

## Frontend Modules

### Auth

Files:

- `frontend/src/app/auth-context.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/data/auth-api.ts`
- `frontend/src/pages/LoginPage.tsx`

Responsibilities:

- Starts GitHub login by navigating to `/api/auth/github`.
- Calls `/api/auth/me` on app load.
- Protects app routes with `RequireAuth`.
- Logs out through `/api/auth/logout`.

Auto-login behavior:

- If the browser still has a valid `gr_session` cookie, `/api/auth/me` succeeds.
- The user is considered logged in automatically.
- If the session expired or was deleted, the user returns to `/login`.

### Repository picker

Files:

- `frontend/src/pages/OnboardingPage.tsx`
- `frontend/src/data/repos-api.ts`
- `frontend/src/types/testlens.ts`

Responsibilities:

- Loads GitHub repos from `/api/repos`.
- Displays a searchable repository picker.
- Shows selected repo details and repo count.
- Calls `/api/repos/:githubRepoId/connect`.
- Stores the internal `repoId` in `localStorage` key `tl.activeRepoId`.

`RepoRef` is the post-clone repository contract. Pre-clone GitHub repositories use
`GitHubRepoSummary`.

## API Surface

Auth:

```http
GET  /api/auth/github
GET  /api/auth/github/callback
GET  /api/auth/me
POST /api/auth/logout
```

Repositories:

```http
GET  /api/repos
POST /api/repos/:githubRepoId/connect
GET  /api/repos/:repoId/files?path=<optional directory path>
GET  /api/repos/:repoId/file?path=<file path>
```

Example read after connecting a repo:

```js
const repoId = localStorage.getItem("tl.activeRepoId");

await fetch(`http://localhost:3000/api/repos/${repoId}/files`, {
  credentials: "include",
}).then(r => r.json());

await fetch(`http://localhost:3000/api/repos/${repoId}/file?path=README.md`, {
  credentials: "include",
}).then(r => r.json());
```

## Environment Setup

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required for this feature:

```env
DATABASE_URL=postgres://guardrail:guardrail@localhost:5432/guardrail

GITHUB_CLIENT_ID=<github oauth app client id>
GITHUB_CLIENT_SECRET=<github oauth app client secret>
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

WORKSPACE_DIR=.guardrail-workspaces
TOKEN_ENC_KEY=<32-byte key>
SESSION_TTL_DAYS=30

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

Generate `TOKEN_ENC_KEY`:

```bash
openssl rand -base64 32
```

Do not commit `.env`. It is ignored by `.gitignore`.

## GitHub OAuth App

For hackathon local development, the team can share one dev OAuth App.

Recommended OAuth App settings:

```text
Application name:
Guardrail Local Dev

Homepage URL:
http://localhost:5173

Authorization callback URL:
http://localhost:3000/api/auth/github/callback
```

Each developer pastes the shared `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` into their own local `.env`.

For a production version, prefer a GitHub App or stricter org allow-listing.

## Local Runbook

Install dependencies:

```bash
pnpm install
```

Start Postgres:

```bash
docker compose up -d
```

Run migrations:

```bash
set -a && source .env && set +a && CI=true pnpm migrate:backend
```

Start backend:

```bash
set -a && source .env && set +a && CI=true pnpm dev:backend
```

Start frontend:

```bash
VITE_API_BASE_URL=http://localhost:3000 CI=true pnpm dev:frontend
```

Open:

```text
http://localhost:5173/login
```

Manual flow:

1. Click "Continue with GitHub".
2. Authorize the OAuth App.
3. Confirm redirect to `/onboarding`.
4. Search/select a repository.
5. Click "Connect Repository".
6. Confirm Step 2 is shown.
7. Confirm clone exists under `backend/.guardrail-workspaces/...`.

## Runtime Checks

Health:

```bash
curl -s http://localhost:3000/health
```

OAuth redirect:

```bash
curl -i -s http://localhost:3000/api/auth/github | sed -n '1,8p'
```

Check cloned repos in DB:

```bash
set -a && source .env && set +a && CI=true pnpm --dir backend exec tsx -e \
"import { Pool } from 'pg'; (async()=>{ const pool=new Pool({connectionString:process.env.DATABASE_URL}); const r=await pool.query('select id, full_name, status, clone_path, commit_sha from repos order by updated_at desc limit 5'); console.log(JSON.stringify(r.rows, null, 2)); await pool.end(); })();"
```

## Troubleshooting

### `/api/auth/github` returns 500 missing GitHub env

Cause: backend process does not have OAuth env vars.

Fix:

- Fill `GITHUB_CLIENT_ID`.
- Fill `GITHUB_CLIENT_SECRET`.
- Set `GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback`.
- Restart backend after editing `.env`.

### GitHub callback fails

Most common cause: callback URL mismatch between `.env` and the GitHub OAuth
App settings.

Both must match exactly:

```text
http://localhost:3000/api/auth/github/callback
```

### Connect repo returns 400 Bad Request

This was caused by sending `Content-Type: application/json` on an empty POST
body. The frontend request helper now only sends `Content-Type` when a body is
present.

### Connect repo returns 422 Repository clone failed

Possible causes:

- Git is not installed.
- The token cannot access the repository.
- The default branch no longer exists.
- Local filesystem permissions block `WORKSPACE_DIR`.

Check backend logs and the `repos.status` column.

### Another machine cannot see my cloned repo

Expected behavior. Clones are local to the backend filesystem. If another
developer runs the app locally, they must connect/clone the repo on their own
machine.

For shared history/clones, run one shared backend + Postgres + workspace server.

## Current Limitations

- No real scan yet; onboarding scan still uses mock UI.
- No UI file browser yet; file-read APIs exist.
- No pagination; `GET /api/repos` returns the first 100 GitHub repos.
- No GitHub org allow-list yet.
- No clone cleanup policy yet.
- No automated tests were added for this hackathon pass.
