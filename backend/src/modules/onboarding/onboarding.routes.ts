import type { FastifyInstance } from 'fastify';
import { AuthRepository } from '../auth/auth.repository.js';
import { requireAuth } from '../auth/session.service.js';
import { decryptToken } from '../auth/token-crypto.js';
import { ReposRepository } from '../repos/repos.repository.js';
import { updateRepository } from '../repos/git-clone.service.js';
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
    const reposRepository = new ReposRepository(app.db);
    let repo = await reposRepository.getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    // Pull the latest commit into the clone before scanning so Run Scan reflects pushed changes.
    // Failure here is non-fatal: fall back to scanning the existing checkout.
    try {
      const encrypted = await new AuthRepository(app.db).getEncryptedToken(user.id);
      if (encrypted) {
        const branch = repo.currentBranch ?? repo.defaultBranch;
        const updated = await updateRepository({
          clonePath: repo.clonePath,
          branch,
          cloneUrl: repo.cloneUrl,
          accessToken: decryptToken(encrypted),
        });
        if (updated.changed) {
          repo = await reposRepository.markCloned(repo.id, repo.clonePath, branch, updated.commitSha);
        }
      }
    } catch (error) {
      request.log.warn({ err: error, repoId }, 'Clone update before scan failed; scanning existing checkout');
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
      return { jobId: result.jobId, summary: result.summary, logs: result.logs };
    } catch (error) {
      request.log.warn({ err: error, repoId }, 'Dashboard scan failed');
      return reply.code(422).send({ error: error instanceof Error ? error.message : 'Scan failed' });
    }
  });
}
