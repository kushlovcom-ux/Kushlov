import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Redis is optional. When REDIS_URL is set we use it for the rate-limit store
 * (and any future Socket.io adapter); otherwise the app falls back to in-memory.
 *
 * A localhost URL is useless (and unreachable) from a serverless function, so we
 * ignore it on Vercel to avoid connection hangs that manifest as
 * FUNCTION_INVOCATION_FAILED.
 *
 * Failures never crash the API — callers treat `null` as “use memory fallback”.
 */
function isUsableRedisUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (process.env.VERCEL && /(^|\/\/)(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
    return false;
  }
  return true;
}

let client: Redis | null = null;
let redisDisabled = false;

export function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (!isUsableRedisUrl(env.REDIS_URL)) return null;
  if (client) return client;

  try {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: Boolean(process.env.VERCEL),
      enableOfflineQueue: false,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });

    client.on('connect', () => logger.info('🔌 Redis connected'));
    client.on('error', (err: Error) => {
      // Log and continue — rate limiting / optional features degrade gracefully.
      logger.warn({ err: err.message }, 'Redis error (continuing without)');
    });

    return client;
  } catch (err) {
    redisDisabled = true;
    client = null;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Redis unavailable, continuing without it',
    );
    return null;
  }
}

export const redisEnabled = isUsableRedisUrl(env.REDIS_URL);

export default getRedis;
