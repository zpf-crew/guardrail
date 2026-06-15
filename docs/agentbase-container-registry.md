# Build and Push to AgentBase Container Registry

This guide builds the Guardrail single-container image and pushes it to the AgentBase managed Container Registry.

The image contains:

- Nginx on port `8080`
- Built React frontend served by Nginx
- Fastify backend proxied behind Nginx
- No embedded Postgres; `DATABASE_URL` points to an external database

## Prerequisites

- Docker or Colima is running.
- GreenNode IAM credentials are configured for AgentBase management scripts.
- The service account has AgentBase Container Registry access.

Check credentials:

```bash
bash .agents/skills/agentbase/scripts/check_credentials.sh iam
```

If Docker is not running locally:

```bash
colima start
```

## Inspect AgentBase Registry

Each user has one pre-provisioned AgentBase CR repository. Read the registry host and repository name:

```bash
bash .agents/skills/agentbase/scripts/cr.sh repo get
```

From the response, note:

- `registryUrl`, usually `vcr.vngcloud.vn`
- `name`, your repository segment

## Build the Image

Use `linux/amd64` for AgentBase Runtime compatibility:

```bash
REGISTRY_URL="vcr.vngcloud.vn"
REPO_NAME="111480-abp111731"
IMAGE_NAME="guardrail"
TAG="v$(date +%Y%m%d%H%M%S)"
IMAGE_URL="${REGISTRY_URL}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

docker build --platform linux/amd64 -t "$IMAGE_URL" .
```

## Login to AgentBase CR

The login script fetches credentials in memory and pipes the secret to Docker. It does not write a credential file.

```bash
bash .agents/skills/agentbase/scripts/cr.sh credentials docker-login
```

## Push the Image

```bash
docker push "$IMAGE_URL"

echo "$IMAGE_URL"
```

Save the printed `IMAGE_URL`; it is the value to pass to AgentBase Runtime later with `--image`.

## Runtime Env File

Create an env file from:

```bash
deploy/agentbase.env.example
```

Required at container startup:

```env
DATABASE_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
TOKEN_ENC_KEY=
LLM_BASE_URL=
LLM_API_KEY=
```

Optional override. In AgentBase Runtime, `deploy/start-container.sh` derives this from `GREENNODE_ENDPOINT_URL` when omitted:

```env
GITHUB_CALLBACK_URL=https://<agentbase-endpoint>/api/auth/github/callback
```

Optional URL overrides. In AgentBase Runtime, `deploy/start-container.sh` derives both from `GREENNODE_ENDPOINT_URL` when omitted:

```env
FRONTEND_URL=https://<agentbase-endpoint>
BACKEND_URL=https://<agentbase-endpoint>
```

Do not include AgentBase auto-injected variables in the env file:

```env
GREENNODE_CLIENT_ID
GREENNODE_CLIENT_SECRET
GREENNODE_AGENT_IDENTITY
GREENNODE_ENDPOINT_URL
```

## Later Runtime Deployment

When creating or updating an AgentBase Custom Agent runtime with this pushed image, use AgentBase CR auth:

```bash
bash .agents/skills/agentbase/scripts/runtime.sh create \
  --name guardrail \
  --image "$IMAGE_URL" \
  --flavor 1x1-general \
  --env-file <path-to-env-file> \
  --from-cr \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu-scale 50 \
  --mem-scale 50
```

For this app, keep replicas at `1` unless repo workspaces, workbench jobs, and artifacts are moved to durable shared storage.

## Troubleshooting

- Docker cannot connect: start Docker Desktop or `colima start`.
- Push unauthorized: rerun `cr.sh credentials docker-login`.
- Push denied: confirm the image path is exactly `{registryUrl}/{repoName}/guardrail:{tag}` from `cr.sh repo get`.
- Runtime does not become active: check that the container listens on `8080` and `GET /health` returns 200.
