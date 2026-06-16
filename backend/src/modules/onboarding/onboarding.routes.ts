import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from 'fastify';
import { env } from '../../config/env.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { requireAuth } from '../auth/session.service.js';
import { decryptToken } from '../auth/token-crypto.js';
import { ReposRepository } from '../repos/repos.repository.js';
import { updateRepository } from '../repos/git-clone.service.js';
import { OnboardingRepository } from './onboarding.repository.js';
import { runOnboardingScan } from './onboarding-scan.service.js';
import type { OnboardingCommitResponse, OnboardingDraftInput, ScanProgress } from './onboarding.types.js';

function sseHeaders(origin: string | undefined): Record<string, string> {
  const allowedOrigin = env.FRONTEND_URL ?? 'http://localhost:5173';
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Runs a scan as a Server-Sent Events stream: emits real `progress` events while the scan works, then a
 * final `result` (or `error`) event. Lets the client show true progress instead of a fake timer.
 */
async function streamScan(
  reply: FastifyReply,
  origin: string | undefined,
  logger: FastifyBaseLogger,
  context: Record<string, unknown>,
  produce: (onProgress: ScanProgress) => Promise<OnboardingCommitResponse>,
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, sseHeaders(origin));
  const write = (event: string, data: unknown) => {
    if (!reply.raw.writableEnded) reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const progress = (event: Parameters<ScanProgress>[0]) => {
    const stamped = { ...event, at: new Date().toISOString() };
    const logContext = {
      ...context,
      percent: event.percent,
      command: event.command,
      detail: event.level === 'warn' ? event.detail : undefined,
    };
    if (event.level === 'warn') {
      logger.warn(logContext, event.message);
    } else {
      logger.info(logContext, event.message);
    }
    write('progress', stamped);
  };

  try {
    logger.info(context, 'Onboarding scan started');
    progress({ message: 'Preparing scan...', percent: 2 });
    const result = await produce(progress);
    logger.info({ ...context, jobId: result.jobId, missingRecommended: result.summary.missingRecommended, suspiciousTests: result.summary.suspiciousTests }, 'Onboarding scan completed');
    write('result', { jobId: result.jobId, summary: result.summary, logs: result.logs, dashboard: result.dashboard });
  } catch (error) {
    logger.error({ ...context, err: error }, 'Onboarding scan failed');
    write('error', { message: error instanceof Error ? error.message : 'Scan failed' });
  } finally {
    if (!reply.raw.writableEnded) reply.raw.end();
  }
}

export async function onboardingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Onboarding's initial scan — streams progress, then persists the result.
  app.post('/:repoId/onboarding/commit', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const draft = (request.body ?? {}) as OnboardingDraftInput;
    const repo = await new ReposRepository(app.db).getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    await streamScan(reply, origin, request.log, { repoId, userId: user.id, operation: 'onboarding.commit' }, async onProgress => {
      const result = await runOnboardingScan(repo, draft, onProgress);
      await new OnboardingRepository(app.db).saveScanResult({
        repoId, userId: user.id, summary: result.summary, logs: result.logs, dashboard: result.dashboard,
      });
      return result;
    });
  });

  app.get('/:repoId/onboarding/result', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const dashboard = await new OnboardingRepository(app.db).getDashboard(repoId, user.id);
    if (!dashboard) {
      return reply.code(404).send({ error: 'No scan result found' });
    }
    return { dashboard };
  });

  app.get('/:repoId/dashboard', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const dashboard = await new OnboardingRepository(app.db).getDashboard(repoId, user.id);
    if (!dashboard) {
      return reply.code(404).send({ error: 'No scan result found' });
    }
    return dashboard;
  });

  // Dashboard "Run Scan" — pulls latest, streams progress, then persists the result.
  app.post('/:repoId/scan', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const reposRepository = new ReposRepository(app.db);
    let repo = await reposRepository.getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    await streamScan(reply, origin, request.log, { repoId, userId: user.id, operation: 'dashboard.scan' }, async onProgress => {
      // Pull the latest commit into the clone before scanning. Failure is non-fatal: scan the checkout.
      try {
        const encrypted = await new AuthRepository(app.db).getEncryptedToken(user.id);
        if (encrypted && repo!.clonePath) {
          onProgress({ message: 'Pulling latest commit…', percent: 4 });
          const branch = repo!.currentBranch ?? repo!.defaultBranch;
          const updated = await updateRepository({
            clonePath: repo!.clonePath, branch, cloneUrl: repo!.cloneUrl, accessToken: decryptToken(encrypted),
          });
          if (updated.changed) {
            repo = await reposRepository.markCloned(repo!.id, repo!.clonePath, branch, updated.commitSha);
          }
        }
      } catch (error) {
        request.log.warn({ err: error, repoId }, 'Clone update before scan failed; scanning existing checkout');
      }

      const result = await runOnboardingScan(repo!, {}, onProgress);
      await new OnboardingRepository(app.db).saveScanResult({
        repoId, userId: user.id, summary: result.summary, logs: result.logs, dashboard: result.dashboard,
      });
      return result;
    });
  });
}
