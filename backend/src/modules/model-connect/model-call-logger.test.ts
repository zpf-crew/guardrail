import test from 'node:test';
import assert from 'node:assert/strict';
import { logModelCallSuccess } from './model-call-logger.js';

test('logModelCallSuccess is silent in test env', () => {
  let called = false;
  const originalInfo = console.info;
  console.info = () => {
    called = true;
  };

  try {
    logModelCallSuccess({
      profile: 'thinker',
      model: 'gemma-4',
      provider: 'primary',
      endpoint: 'https://llm.example/v1',
    });
    assert.equal(called, false);
  } finally {
    console.info = originalInfo;
  }
});

test('logModelCallSuccess prints profile, provider, model, and host', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let output = '';
  const originalInfo = console.info;
  console.info = (message: string) => {
    output = message;
  };

  try {
    logModelCallSuccess({
      profile: 'coder',
      model: 'qwen3.6-plus',
      provider: 'fallback',
      endpoint: 'https://opencode.ai/zen/go/v1',
    });
    assert.match(output, /\[model-connect\] coder call succeeded via fallback \(qwen3.6-plus @ opencode.ai\)/);
  } finally {
    console.info = originalInfo;
    process.env.NODE_ENV = originalEnv;
  }
});
