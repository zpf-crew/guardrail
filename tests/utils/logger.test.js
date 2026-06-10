import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../../src/utils/logger.js';

describe('createLogger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log at info level by default', () => {
    const logger = createLogger();
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('should not log debug when level is info', () => {
    const logger = createLogger('info');
    logger.debug('debug message');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log debug when level is debug', () => {
    const logger = createLogger('debug');
    logger.debug('debug message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('debug message'));
  });

  it('should log errors', () => {
    const logger = createLogger();
    logger.error('error message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('error message'));
  });
});
