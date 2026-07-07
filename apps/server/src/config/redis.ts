import { createRequire } from 'node:module';
import type Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// In the CommonJS Vercel bundle `require` is native; in the ESM server build it
// is not, so fall back to createRequire (import.meta is only read in that case).
const nodeRequire: NodeRequire =
  typeof require === 'function' ? require : createRequire(import.meta.url);

/**
 * Redis is optional. When REDIS_URL is set we use it for the rate-limit store and
 * the Socket.io adapter; otherwise the app gracefully falls back to in-memory.
 *
 * A localhost URL is useless (and unreachable) from a serverless function, so we
 * ignore it on Vercel to avoid connection hangs that manifest as
 * FUNCTION_INVOCATION_FAILED.
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
    // Lazy-load so cold starts never require ioredis unless it is actually used.
    const IORedis = nodeRequire('ioredis') as typeof import('ioredis').default;
    client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: Boolean(process.env.VERCEL),
      enableOfflineQueue: false,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });

    client.on('connect', () => logger.info('🔌 Redis connected'));
    client.on('error', (err: Error) =>
      logger.warn({ err: err.message }, 'Redis error (continuing without)'),
    );

    return client;
  } catch (err) {
    // ioredis not bundled/available — permanently fall back to in-memory.
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
