const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(level = process.env.LOG_LEVEL || 'info') {
  const minLevel = LEVELS[level] ?? LEVELS.info;

  function log(levelName, message, meta = {}) {
    const levelValue = LEVELS[levelName] ?? LEVELS.info;
    if (levelValue < minLevel) return;

    const timestamp = new Date().toISOString();
    const logLine = JSON.stringify({
      timestamp,
      level: levelName,
      message,
      ...meta,
    });
    console.log(logLine);
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  };
}
