import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { formatSse } from './jobs/job-events.js';
import type { WorkbenchService } from './workbench.service.js';
import type { IntentInput, PlanApproval, WorkbenchJob } from './workbench.types.js';

interface SessionParams {
  sessionId: string;
}

interface JobParams extends SessionParams {
  jobId: string;
}

interface CreateSessionBody {
  intent?: Partial<IntentInput>;
}

interface GenerateJobBody {
  approval?: PlanApproval;
}

export function buildWorkbenchRoutes(service: WorkbenchService) {
  return async function workbenchRoutes(app: FastifyInstance) {
    app.post('/sessions', async (request: FastifyRequest<{ Body: CreateSessionBody }>) => {
      return service.createSession(request.body?.intent);
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

    app.post('/:sessionId/run/jobs', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      return startJob(reply, () => service.startJob(request.params.sessionId, 'run'));
    });

    app.post('/:sessionId/review/jobs', async (request: FastifyRequest<{ Params: SessionParams }>, reply) => {
      return startJob(reply, () => service.startJob(request.params.sessionId, 'review'));
    });

    app.get('/:sessionId/jobs/:jobId', async (request: FastifyRequest<{ Params: JobParams }>, reply) => {
      return snapshot(reply, () => service.getJobSnapshot(request.params.sessionId, request.params.jobId));
    });

    app.get(
      '/:sessionId/jobs/:jobId/events',
      async (request: FastifyRequest<{ Params: JobParams }>, reply) => {
        const snapshotResult = snapshot(reply, () => service.getJobSnapshot(request.params.sessionId, request.params.jobId));
        if ('statusCode' in snapshotResult) return snapshotResult;

        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        for (const event of snapshotResult.events) {
          reply.raw.write(formatSse(event));
        }

        const unsubscribe = service.subscribe(request.params.sessionId, request.params.jobId, event => {
          reply.raw.write(formatSse(event));
        });

        request.raw.on('close', unsubscribe);
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
