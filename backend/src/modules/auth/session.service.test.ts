import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSessionCookiePolicy } from './session.service.js';

test('session cookie policy uses lax non-secure cookies for local http development', () => {
  assert.deepEqual(
    resolveSessionCookiePolicy({
      backendUrl: 'http://localhost:3000',
      frontendUrl: 'http://localhost:5173',
    }),
    { secure: false, sameSite: 'lax' },
  );
});

test('session cookie policy keeps same-origin https cookies lax', () => {
  assert.deepEqual(
    resolveSessionCookiePolicy({
      backendUrl: 'https://zpf-crew.site',
      frontendUrl: 'https://zpf-crew.site',
    }),
    { secure: true, sameSite: 'lax' },
  );
});

test('session cookie policy allows cross-origin https frontend requests', () => {
  assert.deepEqual(
    resolveSessionCookiePolicy({
      backendUrl: 'https://zpf-crew.site',
      frontendUrl: 'https://agentbase-runtime.example',
    }),
    { secure: true, sameSite: 'none' },
  );
});
