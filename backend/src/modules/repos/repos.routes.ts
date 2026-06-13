import type { FastifyInstance } from 'fastify';
import { stat } from 'node:fs/promises';
import { AuthRepository } from '../auth/auth.repository.js';
import { requireAuth } from '../auth/session.service.js';
import { decryptToken } from '../auth/token-crypto.js';
import { cloneRepository } from './git-clone.service.js';
import { listGithubRepos } from './github-api.service.js';
import { listRepoFiles, readRepoFile } from './repo-files.service.js';
import { ReposRepository } from './repos.repository.js';
import type { GitHubRepoSummary, RepoRecord } from './repos.types.js';

function toRepoRef(repo: RepoRecord) {
  return {
    name: repo.name,
    path: repo.clonePath ?? '',
    branch: repo.currentBranch ?? repo.defaultBranch,
    commit: repo.commitSha ?? undefined,
  };
}

function publicRepo(repo: GitHubRepoSummary): GitHubRepoSummary {
  return repo;
}

async function cloneExists(clonePath: string | null): Promise<boolean> {
  if (!clonePath) return false;
  return stat(clonePath).then(info => info.isDirectory()).catch(() => false);
}

async function getAccessToken(app: FastifyInstance, userId: string): Promise<string> {
  const encrypted = await new AuthRepository(app.db).getEncryptedToken(userId);
  if (!encrypted) {
    throw new Error('GitHub token is missing; reconnect GitHub');
  }
  return decryptToken(encrypted);
}

export async function reposRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request) => {
    const user = request.user!;
    const token = await getAccessToken(app, user.id);
    const repository = new ReposRepository(app.db);
    const localRepos = await repository.listForUser(user.id);
    const localByGithubId = new Map(localRepos.map(repo => [repo.githubRepoId, repo]));
    const repos = await listGithubRepos(token);
    return repos.map(({ cloneUrl: _cloneUrl, ...repo }) => {
      const local = localByGithubId.get(repo.githubRepoId);
      return publicRepo({
        ...repo,
        repoId: local?.id,
        status: local?.status,
        isCloned: Boolean(local?.clonePath && local.status === 'cloned'),
        clonePath: local?.clonePath ?? undefined,
        currentBranch: local?.currentBranch ?? undefined,
        commitSha: local?.commitSha ?? undefined,
        lastClonedAt: local?.lastClonedAt ?? undefined,
      });
    });
  });

  app.post('/:githubRepoId/connect', async (request, reply) => {
    const user = request.user!;
    const { githubRepoId } = request.params as { githubRepoId: string };
    const numericGithubRepoId = Number(githubRepoId);
    if (!Number.isSafeInteger(numericGithubRepoId)) {
      return reply.code(400).send({ error: 'Invalid GitHub repo id' });
    }

    const token = await getAccessToken(app, user.id);
    const githubRepo = (await listGithubRepos(token)).find(repo => repo.githubRepoId === numericGithubRepoId);
    if (!githubRepo) {
      return reply.code(404).send({ error: 'GitHub repository not found or not accessible' });
    }

    const repository = new ReposRepository(app.db);
    const repo = await repository.upsertPending({ userId: user.id, ...githubRepo });
    if (repo.status === 'cloned' && await cloneExists(repo.clonePath)) {
      return { repoId: repo.id, repo: toRepoRef(repo), reused: true };
    }

    try {
      const cloned = await cloneRepository({
        userId: user.id,
        repoId: repo.id,
        cloneUrl: repo.cloneUrl,
        defaultBranch: repo.defaultBranch,
        accessToken: token,
      });
      const clonedRepo = await repository.markCloned(repo.id, cloned.clonePath, cloned.branch, cloned.commitSha);
      return { repoId: clonedRepo.id, repo: toRepoRef(clonedRepo) };
    } catch {
      await repository.markFailed(repo.id);
      request.log.warn({ repoId: repo.id }, 'Repository clone failed');
      return reply.code(422).send({ error: 'Repository clone failed' });
    }
  });

  app.get('/:repoId/files', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const { path = '' } = request.query as { path?: string };
    const repo = await new ReposRepository(app.db).getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    try {
      return { nodes: await listRepoFiles(repo.clonePath, path) };
    } catch (error) {
      request.log.warn({ err: error, repoId }, 'Repository tree read failed');
      return reply.code(400).send({ error: 'Unable to read repository path' });
    }
  });

  app.get('/:repoId/file', async (request, reply) => {
    const user = request.user!;
    const { repoId } = request.params as { repoId: string };
    const { path } = request.query as { path?: string };
    if (!path) {
      return reply.code(400).send({ error: 'path query parameter is required' });
    }

    const repo = await new ReposRepository(app.db).getForUser(repoId, user.id);
    if (!repo || !repo.clonePath) {
      return reply.code(404).send({ error: 'Repository clone not found' });
    }

    try {
      const file = await readRepoFile(repo.clonePath, path);
      return { path, content: file.content, size: file.size };
    } catch (error) {
      request.log.warn({ err: error, repoId, path }, 'Repository file read failed');
      return reply.code(400).send({ error: 'Unable to read repository file' });
    }
  });
}
