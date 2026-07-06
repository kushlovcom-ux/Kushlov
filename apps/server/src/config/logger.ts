import pino from 'pino';
import { isDev } from './env';

/**
 * Structured application logger. Pretty-prints in development, JSON in production
 * so logs can be shipped to any aggregator (Datadog, Loki, CloudWatch, etc.).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      }
    : undefined,
  base: { service: 'kushlov-api' },
});
