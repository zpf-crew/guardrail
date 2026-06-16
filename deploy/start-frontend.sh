#!/bin/sh
set -eu

if [ -z "${BACKEND_URL:-}" ]; then
  echo "Missing required environment variable: BACKEND_URL" >&2
  exit 1
fi

runtime_config_file="/usr/share/nginx/html/runtime-config.js"
runtime_config_json="$(RUNTIME_API_BASE="$BACKEND_URL" node -e 'process.stdout.write(JSON.stringify({ apiBaseUrl: process.env.RUNTIME_API_BASE || "" }))')"
printf 'window.__GUARDRAIL_CONFIG__ = %s;\n' "$runtime_config_json" > "$runtime_config_file"

echo "Runtime frontend configuration:"
echo "  BACKEND_URL=${BACKEND_URL}"

exec nginx -g 'daemon off;'
