import { readFile } from 'node:fs/promises';
import path from 'node:path';

const supportedSkillNames = new Set([
  'test-isolation-files',
  'test-isolation-unit',
  'test-plan',
  'test-plan-unit',
  'test-generate-ui-browser',
  'test-generate-unit',
  'test-run-unit',
  'test-run-ui-browser-agent',
  'test-review',
  'test-review-unit',
]);

export interface SkillContract {
  name: string;
  content: string;
}

export interface SkillContractLoaderOptions {
  skillsDir: string;
}

export class SkillContractLoader {
  constructor(private readonly options: SkillContractLoaderOptions) {}

  async load(name: string): Promise<SkillContract> {
    if (!supportedSkillNames.has(name)) {
      throw new Error(`Unsupported skill name: ${name}`);
    }

    const skillPath = path.join(this.options.skillsDir, `${name}.md`);

    try {
      const content = await readFile(skillPath, 'utf8');
      return { name, content };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new Error(`Skill contract not found for ${name}: ${skillPath}`);
      }

      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
