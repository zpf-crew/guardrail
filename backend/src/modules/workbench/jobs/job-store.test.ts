import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkbenchJobStore } from './job-store.js';

test('job store records sessions, jobs, events, and step results', () => {
  const store = new WorkbenchJobStore();
  const session = store.createSession({
    prompt: 'Run onboarding UI Browser test',
    feature: 'Checkout',
    testTypes: ['UI / Browser'],
    sources: ['Codebase', 'QC test cases'],
  });

  const job = store.createJob(session.id, 'isolation');
  store.appendEvent(session.id, job.id, { type: 'progress', jobId: job.id, step: 'isolation', message: 'Loaded repo context' });
  store.setJobStatus(session.id, job.id, 'running');
  store.setStepResult(session.id, 'isolation', {
    target: { feature: 'Checkout', repo: session.repo },
    sourceFiles: [],
    existingTestFiles: [],
    specDocs: [],
    qcCases: [],
    currentCoverage: { line: 0, branch: 0 },
    currentStatus: { failed: 0, suspicious: 0, missing: 1 },
    userJourneys: ['Open onboarding'],
    classifications: [],
  });

  assert.equal(store.getSession(session.id)?.steps.isolation, 'done');
  assert.equal(store.getJob(session.id, job.id)?.status, 'running');
  assert.equal(store.getEvents(session.id, job.id).length, 1);
  assert.equal(store.getSession(session.id)?.isolation?.currentStatus.missing, 1);
});

test('job store returns snapshots that do not mutate internal state', () => {
  const store = new WorkbenchJobStore();
  const session = store.createSession({ prompt: 'Check snapshots' });
  const job = store.createJob(session.id, 'plan');

  session.intent.prompt = 'mutated prompt';
  session.steps.plan = 'done';
  job.status = 'failed';

  assert.equal(store.getSession(session.id)?.intent.prompt, 'Check snapshots');
  assert.equal(store.getSession(session.id)?.steps.plan, 'locked');
  assert.equal(store.getJob(session.id, job.id)?.status, 'queued');
});

test('job store does not retain caller-owned intent arrays', () => {
  const store = new WorkbenchJobStore();
  const testTypes: Array<'UI / Browser' | 'Unit'> = ['UI / Browser'];
  const sources: Array<'Codebase' | 'QC test cases'> = ['Codebase'];
  const session = store.createSession({
    prompt: 'Check caller arrays',
    testTypes,
    sources,
  });

  testTypes.push('Unit');
  sources.push('QC test cases');

  const mutableTestTypes = session.intent.testTypes;
  const mutableSources = session.intent.sources;
  mutableTestTypes.push('Unit');
  mutableSources.push('QC test cases');

  assert.deepEqual(store.getSession(session.id)?.intent.testTypes, ['UI / Browser']);
  assert.deepEqual(store.getSession(session.id)?.intent.sources, ['Codebase']);
});
