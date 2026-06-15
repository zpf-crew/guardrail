import { createReadStream } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { requireAuth } from '../auth/session.service.js';
import { decryptToken } from '../auth/token-crypto.js';
import { ReposRepository } from '../repos/repos.repository.js';
import { createPullRequest } from './pr/create-pull-request.service.js';
import { buildPullRequestBody } from './pr/build-pr-body.js';
import { formatSse } from './jobs/job-events.js';
import type { WorkbenchService } from './workbench.service.js';
import type { IntentInput, PlanApproval, RunOptions, WorkbenchJob, WorkbenchJobEvent } from './workbench.types.js';

interface SessionParams {
  sessionId: string;
}

interface JobParams extends SessionParams {
  jobId: string;
}

interface ArtifactParams extends SessionParams {
  artifactId: string;
}

interface CreateSessionBody {
  repoId?: string;
  intent?: Partial<IntentInput>;
}

interface UpdateSessionBody {
  intent?: Partial<IntentInput>;
}

interface GenerateJobBody {
  approval?: PlanApproval;
}

interface RunJobBody extends RunOptions {}

export function buildWorkbenchRoutes(service: WorkbenchService) {
  return async function workbenchRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireAuth);

    app.post('/sessions', async (request: FastifyRequest<{ Body: CreateSessionBody }>, reply) => {
      const user = request.user!;
      const body = request.body ?? {};
      if (!body.repoId) {
        return reply.code(400).send({ error: 'repoId is required' });
      }

      const repo = await new ReposRepository(app.db).getForUser(body.repoId, user.id);
      if (!repo?.clonePath || repo.status !== 'cloned') {
        return reply.code(404).send({ error: 'Repository clone not found' });
      }

      return service.createSession(
        body.repoId,
        user.id,
        {
          name: repo.name,
          path: repo.clonePath,
          branch: repo.currentBranch ?? repo.defaultBranch,
          commit: repo.commitSha ?? undefined,
        },
        body.intent,
      );
    });

    app.get('/:sessionId', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      try {
        const user = request.user!;
        return service.getSession(request.params.sessionId, user.id);
      } catch (error) {
        return routeError(reply, error);
      }
    });

    app.patch('/:sessionId', async (request: FastifyRequest<{ Params: SessionParams; Body: UpdateSessionBody }>, reply) => {
      try {
        return service.updateSessionIntent(request.params.sessionId, request.body?.intent ?? {});
      } catch (error) {
        return routeError(reply, error);
      }
    });

    app.get('/:sessionId/artifacts/:artifactId', async (request: FastifyRequest<{ Params: ArtifactParams }>, reply) => {
      try {
        const artifact = service.getArtifact(request.params.sessionId, request.params.artifactId);
        if (!artifact) return reply.code(404).send({ error: 'Workbench artifact not found' });

        reply.header('Content-Type', artifact.contentType);
        reply.header('Cache-Control', 'no-store');
        return reply.send(createReadStream(artifact.filePath));
      } catch (error) {
        return routeError(reply, error);
      }
    });

    app.post('/:sessionId/analyze/jobs', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      return startJob(reply, () => service.startJob(request.params.sessionId, 'isolation'));
    });

    app.post('/:sessionId/plan/jobs', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      return startJob(reply, () => service.startJob(request.params.sessionId, 'plan'));
    });

    app.post(
      '/:sessionId/generate/jobs',
      async (request: FastifyRequest<{ Params: SessionParams; Body: GenerateJobBody }>, reply) => {
        return startJob(reply, () => service.startJob(request.params.sessionId, 'generate', request.body?.approval));
      },
    );

    app.post(
      '/:sessionId/run/jobs',
      async (request: FastifyRequest<{ Params: SessionParams; Body: RunJobBody }>, reply) => {
        return startJob(reply, () => service.startJob(request.params.sessionId, 'run', undefined, request.body ?? {}));
      },
    );

    app.post('/:sessionId/review/jobs', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      return startJob(reply, () => service.startJob(request.params.sessionId, 'review'));
    });

    app.post('/:sessionId/pull-request', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      const user = request.user!;
      let session;
      try {
        session = service.getSession(request.params.sessionId, user.id);
      } catch (error) {
        return routeError(reply, error);
      }

      const changes = session.generation?.changes ?? [];
      if (!changes.length) {
        return reply.code(400).send({ error: 'No generated changes to open a pull request for.' });
      }

      const repo = await new ReposRepository(app.db).getForUser(session.repoId, user.id);
      if (!repo?.clonePath) {
        return reply.code(404).send({ error: 'Repository clone not found' });
      }
      const encrypted = await new AuthRepository(app.db).getEncryptedToken(user.id);
      if (!encrypted) {
        return reply.code(401).send({ error: 'GitHub token is missing; reconnect GitHub.' });
      }

      const baseBranch = repo.currentBranch ?? repo.defaultBranch;
      try {
        const result = await createPullRequest({
          clonePath: repo.clonePath,
          cloneUrl: repo.cloneUrl,
          fullName: repo.fullName,
          baseBranch,
          accessToken: decryptToken(encrypted),
          changes,
          title: `test: add ${changes.length} Guardrail-generated test${changes.length === 1 ? '' : 's'}`,
          body: buildPullRequestBody({ changes, run: session.run, review: session.review }),
        });
        return { url: result.url, branch: result.branch };
      } catch (error) {
        request.log.warn({ err: error, sessionId: session.id }, 'Create pull request failed');
        return reply.code(422).send({ error: error instanceof Error ? error.message : 'Failed to open pull request' });
      }
    });

    app.get('/:sessionId/jobs/:jobId', async (request: FastifyRequest<{ Params: JobParams }>, reply) => {
      return snapshot(reply, () => service.getJobSnapshot(request.params.sessionId, request.params.jobId));
    });

    app.get(
      '/:sessionId/jobs/:jobId/events',
      async (request: FastifyRequest<{ Params: JobParams }>, reply) => {
        const liveEvents: WorkbenchJobEvent[] = [];
        let replaying = true;
        let unsubscribe: (() => void) | undefined;
        let snapshotResult: ReturnType<WorkbenchService['getJobSnapshot']>;

        try {
          unsubscribe = service.subscribe(request.params.sessionId, request.params.jobId, event => {
            if (replaying) {
              liveEvents.push(event);
              return;
            }

            writeEvent(reply, event, cleanup);
          });
          snapshotResult = service.getJobSnapshot(request.params.sessionId, request.params.jobId);
        } catch (error) {
          unsubscribe?.();
          return routeError(reply, error);
        }

        reply.hijack();
        reply.raw.writeHead(200, sseResponseHeaders(request));

        const replayCounts = new Map<string, number>();
        for (const event of snapshotResult.events) {
          increment(replayCounts, event);
          writeEvent(reply, event, cleanup);
        }

        replaying = false;
        for (const event of liveEvents) {
          if (decrement(replayCounts, event)) continue;
          writeEvent(reply, event, cleanup);
        }

        request.raw.on('close', cleanup);

        function cleanup(): void {
          unsubscribe?.();
          unsubscribe = undefined;
          if (!reply.raw.writableEnded) reply.raw.end();
        }
      },
    );
  };
}

function startJob(reply: FastifyReply, createJob: () => WorkbenchJob) {
  try {
    const job = createJob();
    return { jobId: job.id, step: job.step, status: job.status };
  } catch (error) {
    return routeError(reply, error);
  }
}

function snapshot<T>(reply: FastifyReply, getSnapshot: () => T): T | FastifyReply {
  try {
    return getSnapshot();
  } catch (error) {
    return routeError(reply, error);
  }
}

function routeError(reply: FastifyReply, error: unknown): FastifyReply {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = /not found/i.test(message) ? 404 : 400;
  return reply.code(statusCode).send({ error: message });
}

function writeEvent(reply: FastifyReply, event: WorkbenchJobEvent, close: () => void): void {
  if (reply.raw.writableEnded) return;

  reply.raw.write(formatSse(event));
  if (isSseTerminalEvent(event)) close();
}

function isSseTerminalEvent(event: WorkbenchJobEvent): boolean {
  return (event.type === 'status' && event.status === 'succeeded') || event.type === 'error';
}

function increment(counts: Map<string, number>, event: WorkbenchJobEvent): void {
  const key = eventKey(event);
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function decrement(counts: Map<string, number>, event: WorkbenchJobEvent): boolean {
  const key = eventKey(event);
  const count = counts.get(key) ?? 0;
  if (count === 0) return false;
  if (count === 1) counts.delete(key);
  else counts.set(key, count - 1);
  return true;
}

function eventKey(event: WorkbenchJobEvent): string {
  return JSON.stringify(event);
}

function sseResponseHeaders(request: FastifyRequest): Record<string, string> {
  const allowedOrigin = env.FRONTEND_URL ?? 'http://localhost:5173';
  const requestOrigin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
  const allowOrigin = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
