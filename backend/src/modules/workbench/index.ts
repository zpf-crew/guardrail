import path from 'node:path';
import { UiBrowserAdapter } from './adapters/ui-browser/ui-browser.adapter.js';
import { WorkbenchJobEventBus } from './jobs/job-events.js';
import { WorkbenchJobQueue } from './jobs/job-queue.js';
import { WorkbenchJobStore } from './jobs/job-store.js';
import { LocalGuardrailRepositoryProvider } from './repositories/local-guardrail-repository-provider.js';
import { buildWorkbenchRoutes } from './workbench.routes.js';
import { WorkbenchService } from './workbench.service.js';

export { WorkbenchService } from './workbench.service.js';
export { buildWorkbenchRoutes } from './workbench.routes.js';

const rootDir = path.basename(process.cwd()) === 'backend'
  ? path.dirname(process.cwd())
  : process.cwd();

const workbenchService = new WorkbenchService(
  new WorkbenchJobStore(),
  new WorkbenchJobQueue({ concurrency: 1 }),
  new WorkbenchJobEventBus(),
  new LocalGuardrailRepositoryProvider({ rootDir }),
  [new UiBrowserAdapter()],
);

export const workbenchRoutes = buildWorkbenchRoutes(workbenchService);
