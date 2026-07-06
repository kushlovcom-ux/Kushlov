import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Redis is optional. When REDIS_URL is set we use it for the rate-limit store and
 * the Socket.io adapter; otherwise the app gracefully falls back to in-memory.
 */
let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: Boolean(process.env.VERCEL),
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on('connect', () => logger.info('🔌 Redis connected'));
  client.on('error', (err) => logger.warn({ err: err.message }, 'Redis error (continuing without)'));

  return client;
}

export const redisEnabled = Boolean(env.REDIS_URL);
