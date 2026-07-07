import { createRequire } from 'node:module';
import type Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

const require = createRequire(import.meta.url);

/**
 * Redis is optional. When REDIS_URL is set we use it for the rate-limit store and
 * the Socket.io adapter; otherwise the app gracefully falls back to in-memory.
 */
let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  // Lazy-load so Vercel serverless cold starts never require ioredis unless configured.
  const IORedis = require('ioredis') as typeof import('ioredis').default;
  client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: Boolean(process.env.VERCEL),
    retryStrategy: (times: number) => Math.min(times * 200, 2000),
  });

  client.on('connect', () => logger.info('🔌 Redis connected'));
  client.on('error', (err: Error) =>
    logger.warn({ err: err.message }, 'Redis error (continuing without)'),
  );

  return client;
}

export const redisEnabled = Boolean(env.REDIS_URL);
