import type { FastifyServerOptions } from 'fastify';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw && LOG_LEVELS.includes(raw as LogLevel)) return raw as LogLevel;
  return 'info';
}

/** Fastify/Pino logger config: pretty + color in dev, JSON in production, off in tests. */
export function buildLoggerConfig(): FastifyServerOptions['logger'] {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  const level = resolveLogLevel();

  if (process.env.NODE_ENV === 'production') {
    return { level };
  }

  return {
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: true,
        messageFormat: '{if req}{req.method} {req.url}{end}{if res} {res.statusCode}{end} {msg}',
      },
    },
  };
}
