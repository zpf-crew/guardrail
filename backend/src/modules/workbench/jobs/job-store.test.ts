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
