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

test('loads unit workbench skill contracts by name', async () => {
  const skillsDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-skills-'));
  const names = [
    'test-isolation-unit',
    'test-plan-unit',
    'test-generate-unit',
    'test-run-unit',
    'test-review-unit',
  ];
  for (const name of names) {
    await writeFile(path.join(skillsDir, `${name}.md`), `# ${name}\n`);
  }

  const loader = new SkillContractLoader({ skillsDir });
  for (const name of names) {
    const contract = await loader.load(name);
    assert.equal(contract.name, name);
    assert.equal(contract.content, `# ${name}\n`);
  }
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

test('loads UI Browser flow planning skill contracts', async () => {
  const skillsDir = await mkdtemp(path.join(os.tmpdir(), 'guardrail-skills-'));
  await writeFile(path.join(skillsDir, 'test-plan-ui-browser-flows.md'), '# Gherkin To User Flow\n\nReturn JSON only.\n');
  await writeFile(path.join(skillsDir, 'test-plan-ui-browser-execution.md'), '# User Flow To Execution\n\nReturn JSON only.\n');

  const loader = new SkillContractLoader({ skillsDir });

  const flowSkill = await loader.load('test-plan-ui-browser-flows');
  const executionSkill = await loader.load('test-plan-ui-browser-execution');

  assert.equal(flowSkill.name, 'test-plan-ui-browser-flows');
  assert.match(flowSkill.content, /Gherkin To User Flow/);
  assert.equal(executionSkill.name, 'test-plan-ui-browser-execution');
  assert.match(executionSkill.content, /User Flow To Execution/);
});
