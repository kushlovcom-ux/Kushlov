import rateLimit, { Options } from 'express-rate-limit';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Build a rate limiter backed by Redis when available (so limits are shared
 * across instances), otherwise the default in-memory store.
 */
function buildLimiter(options: Partial<Options>) {
  const redis = getRedis();
  let store: Options['store'] | undefined;

  if (redis) {
    try {
      // Lazy require keeps this optional dependency from breaking startup.
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { RedisStore } = require('rate-limit-redis');
      store = new RedisStore({
        sendCommand: (...args: string[]) => (redis.call as (...a: string[]) => unknown)(...args),
      });
    } catch (err) {
      logger.warn('rate-limit-redis unavailable, using memory store');
    }
  }

  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    message: { success: false, message: 'Too many requests, please try again later.' },
    ...options,
  });
}

/** Global limiter applied to the whole API. */
export const globalLimiter = buildLimiter({});

/** Stricter limiter for auth endpoints to slow down brute-force attempts. */
export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});
