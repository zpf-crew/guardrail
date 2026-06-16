FROM node:20-bookworm-slim AS build

WORKDIR /app
ENV UV_USE_IO_URING=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

COPY backend backend
COPY frontend frontend
COPY guardrail-skills guardrail-skills

RUN pnpm --dir frontend build
RUN pnpm --dir backend build
RUN pnpm --filter guardrail-backend --prod deploy --legacy /app/backend-prod

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV UV_USE_IO_URING=0
ENV PORT=3000
ENV WORKSPACE_DIR=/tmp/guardrail-workspaces

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    nginx \
    git \
    ca-certificates \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.14.0 --activate \
  && corepack prepare yarn@1.22.22 --activate \
  && npm install -g agent-browser \
  && agent-browser install --with-deps \
  && mkdir -p /run/nginx /tmp/guardrail-workspaces /app

ENV AGENT_BROWSER_ARGS=--no-sandbox,--disable-dev-shm-usage

WORKDIR /app

COPY --from=build /app/backend-prod /app/backend
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/db /app/backend/db
COPY --from=build /app/guardrail-skills /app/guardrail-skills
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/start-container.sh /usr/local/bin/start-container.sh

RUN chmod +x /usr/local/bin/start-container.sh

EXPOSE 8080

CMD ["/usr/local/bin/start-container.sh"]
