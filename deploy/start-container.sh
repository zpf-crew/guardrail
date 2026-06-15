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

if [ -n "${GREENNODE_ENDPOINT_URL:-}" ]; then
  export FRONTEND_URL="${FRONTEND_URL:-$GREENNODE_ENDPOINT_URL}"
  export BACKEND_URL="${BACKEND_URL:-$GREENNODE_ENDPOINT_URL}"
  export GITHUB_CALLBACK_URL="${GITHUB_CALLBACK_URL:-${GREENNODE_ENDPOINT_URL%/}/api/auth/github/callback}"
fi

echo "Runtime environment diagnostics:"
echo "  NODE_ENV=${NODE_ENV}"
echo "  PORT=${PORT}"
echo "  GREENNODE_ENDPOINT_URL=${GREENNODE_ENDPOINT_URL:-<unset>}"
echo "  FRONTEND_URL=${FRONTEND_URL:-<unset>}"
echo "  BACKEND_URL=${BACKEND_URL:-<unset>}"
echo "  GITHUB_CALLBACK_URL=${GITHUB_CALLBACK_URL:-<unset>}"
if [ -n "${GITHUB_CLIENT_ID:-}" ]; then
  echo "  GITHUB_CLIENT_ID=<set>"
else
  echo "  GITHUB_CLIENT_ID=<unset>"
fi
if [ -n "${GITHUB_CLIENT_SECRET:-}" ]; then
  echo "  GITHUB_CLIENT_SECRET=<set>"
else
  echo "  GITHUB_CLIENT_SECRET=<unset>"
fi

runtime_api_base="${BACKEND_URL:-}"
runtime_config_file="/usr/share/nginx/html/runtime-config.js"
runtime_config_json="$(RUNTIME_API_BASE="$runtime_api_base" node -e 'process.stdout.write(JSON.stringify({ apiBaseUrl: process.env.RUNTIME_API_BASE || "" }))')"
printf 'window.__GUARDRAIL_CONFIG__ = %s;\n' "$runtime_config_json" > "$runtime_config_file"
echo "  Runtime frontend apiBaseUrl=${runtime_api_base:-<same-origin>}"

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
