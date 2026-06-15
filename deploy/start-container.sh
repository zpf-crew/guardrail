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

cd /app/backend

node dist/db/migrate.js

node dist/server.js &
backend_pid="$!"

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}
trap cleanup INT TERM

backend_ready=0
for _ in $(seq 1 60); do
  if node -e "fetch('http://127.0.0.1:${PORT}/health/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    backend_ready=1
    break
  fi
  sleep 1
done

if [ "$backend_ready" -ne 1 ]; then
  echo "Backend did not become healthy before timeout" >&2
  exit 1
fi

if ! kill -0 "$backend_pid" 2>/dev/null; then
  wait "$backend_pid"
fi

exec nginx -g 'daemon off;'
