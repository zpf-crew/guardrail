import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SkillContractLoader } from './skill-contract-loader.js';

test('loads a supported skill contract by name', async () => {
  const skillsDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-skills-'));
  await writeFile(path.join(skillsDir, 'test-plan.md'), '# Test Plan\n\nReturn JSON only.\n');

  const loader = new SkillContractLoader({ skillsDir });
  const contract = await loader.load('test-plan');

  assert.deepEqual(contract, {
    name: 'test-plan',
    content: '# Test Plan\n\nReturn JSON only.\n',
  });
});

test('rejects unsafe skill names', async () => {
  const skillsDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-skills-'));
  const loader = new SkillContractLoader({ skillsDir });

  await assert.rejects(
    () => loader.load('../secret'),
    /Unsupported skill name: \.\.\/secret/,
  );
});

test('missing supported skill files name the skill in the error', async () => {
  const skillsDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-skills-'));
  const loader = new SkillContractLoader({ skillsDir });

  await assert.rejects(
    () => loader.load('test-review'),
    /Skill contract not found for test-review/,
  );
});
