import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { UiBrowserAdapter } from './adapters/ui-browser/ui-browser.adapter.js';
import { UnitAdapter } from './adapters/unit/unit.adapter.js';
import { WorkbenchArtifactStore } from './artifacts/workbench-artifact-store.js';
import { WorkbenchJobEventBus } from './jobs/job-events.js';
import { WorkbenchJobQueue } from './jobs/job-queue.js';
import { WorkbenchJobStore } from './jobs/job-store.js';
import { ClonedRepoRepositoryProvider } from './repositories/cloned-repo-repository-provider.js';
import { buildWorkbenchRoutes } from './workbench.routes.js';
import { WorkbenchService } from './workbench.service.js';

export { WorkbenchService } from './workbench.service.js';
export { buildWorkbenchRoutes } from './workbench.routes.js';

export function createWorkbenchService(db: Pool): WorkbenchService {
  return new WorkbenchService(
    new WorkbenchJobStore(),
    new WorkbenchJobQueue({ concurrency: 1 }),
    new WorkbenchJobEventBus(),
    new WorkbenchArtifactStore(),
    ClonedRepoRepositoryProvider.fromDb(db),
    [new UiBrowserAdapter(), new UnitAdapter()],
  );
}

export async function registerWorkbenchRoutes(app: FastifyInstance) {
  const service = createWorkbenchService(app.db);
  await app.register(buildWorkbenchRoutes(service), { prefix: '/api/workbench' });
}
