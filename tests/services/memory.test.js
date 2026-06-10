import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryService } from '../../src/services/memory.js';

describe('createMemoryService', () => {
  let memoryService;

  beforeEach(() => {
    memoryService = createMemoryService(':memory:');
  });

  it('creates a new thread', () => {
    const threadId = memoryService.createThread();
    expect(threadId).toBeDefined();
    expect(typeof threadId).toBe('string');
    expect(threadId.length).toBeGreaterThan(0);
  });

  it('adds and retrieves messages', () => {
    const threadId = memoryService.createThread();
    memoryService.addMessage(threadId, 'user', 'Hello');
    memoryService.addMessage(threadId, 'assistant', 'Hi there');

    const messages = memoryService.getMessages(threadId);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hi there');
  });

  it('returns empty array for unknown thread', () => {
    const messages = memoryService.getMessages('nonexistent');
    expect(messages).toEqual([]);
  });

  it('returns messages ordered by timestamp', () => {
    const threadId = memoryService.createThread();
    memoryService.addMessage(threadId, 'user', 'First');
    memoryService.addMessage(threadId, 'user', 'Second');

    const messages = memoryService.getMessages(threadId);
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
  });
});
