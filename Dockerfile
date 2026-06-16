FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile

COPY frontend frontend

RUN pnpm --dir frontend build

FROM node:20-bookworm-slim AS runtime

ENV BACKEND_URL=

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/nginx

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/start-frontend.sh /usr/local/bin/start-frontend.sh

RUN chmod +x /usr/local/bin/start-frontend.sh

EXPOSE 8080

CMD ["/usr/local/bin/start-frontend.sh"]
