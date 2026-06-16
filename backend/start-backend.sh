#!/bin/sh
set -eu

required_env="
DATABASE_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
TOKEN_ENC_KEY
LLM_BASE_URL
LLM_API_KEY
"

missing_env=""
for name in $required_env; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    missing_env="${missing_env} ${name}"
  fi
done

if [ -n "$missing_env" ]; then
  echo "Missing required environment variables:${missing_env}" >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export WORKSPACE_DIR="${WORKSPACE_DIR:-/tmp/guardrail-workspaces}"

echo "Backend runtime environment diagnostics:"
echo "  NODE_ENV=${NODE_ENV}"
echo "  PORT=${PORT}"
echo "  FRONTEND_URL=${FRONTEND_URL:-<unset>}"
echo "  BACKEND_URL=${BACKEND_URL:-<unset>}"
echo "  GITHUB_CALLBACK_URL=${GITHUB_CALLBACK_URL:-<unset>}"
echo "  WORKSPACE_DIR=${WORKSPACE_DIR}"

mkdir -p "$WORKSPACE_DIR"

node dist/db/migrate.js

exec node dist/server.js
