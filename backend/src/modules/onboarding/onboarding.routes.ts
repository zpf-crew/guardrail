import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/session.service.js';
import { ReposRepository } from '../repos/repos.repository.js';
import { OnboardingRepository } from './onboarding.repository.js';
import { runOnboardingScan } from './onboarding-scan.service.js';
import type { OnboardingDraftInput } from './onboarding.types.js';

export async function onboardingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.post('/:repoId/onboarding/commit', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const repo = await new ReposRepository(app.db).getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    try {
      const result = await runOnboardingScan(repo, (request.body ?? {}) as OnboardingDraftInput);
      await new OnboardingRepository(app.db).saveScanResult({
        repoId,
        userId: user.id,
        summary: result.summary,
        logs: result.logs,
        dashboard: result.dashboard,
      });
      return result;
    } catch (error) {
      request.log.warn({ err: error, repoId }, 'Onboarding scan failed');
      return reply.code(422).send({ error: error instanceof Error ? error.message : 'Onboarding scan failed' });
    }
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

  app.post('/:repoId/scan', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const repo = await new ReposRepository(app.db).getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    try {
      const result = await runOnboardingScan(repo, {});
      await new OnboardingRepository(app.db).saveScanResult({
        repoId,
        userId: user.id,
        summary: result.summary,
        logs: result.logs,
        dashboard: result.dashboard,
      });
      return { jobId: result.jobId };
    } catch (error) {
      request.log.warn({ err: error, repoId }, 'Dashboard scan failed');
      return reply.code(422).send({ error: error instanceof Error ? error.message : 'Scan failed' });
    }
  });
}
