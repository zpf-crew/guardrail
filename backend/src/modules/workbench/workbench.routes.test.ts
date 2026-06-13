import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../app.js';

test('workbench routes create session, start analyze job, and expose job events', async () => {
  const app = buildApp();

  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/workbench/sessions',
    payload: { intent: { prompt: 'Test onboarding', feature: 'Checkout', testTypes: ['UI / Browser'], sources: ['Codebase'] } },
  });
  assert.equal(sessionRes.statusCode, 200);
  const session = sessionRes.json();

  const jobRes = await app.inject({ method: 'POST', url: `/api/workbench/${session.id}/analyze/jobs` });
  assert.equal(jobRes.statusCode, 200);
  const job = jobRes.json();
  assert.equal(job.step, 'isolation');

  await new Promise(resolve => setTimeout(resolve, 20));
  const snapshotRes = await app.inject({ method: 'GET', url: `/api/workbench/${session.id}/jobs/${job.jobId}` });
  assert.equal(snapshotRes.statusCode, 200);
  assert.ok(snapshotRes.json().events.length >= 1);
});
