import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Build a rate limiter backed by Redis when available (so limits are shared
 * across instances), otherwise the default in-memory store.
 */
function buildLimiter(options: Partial<Options>): RateLimitRequestHandler {
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
    } catch {
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

function lazyLimiter(options: Partial<Options> = {}): RequestHandler {
  let limiter: RateLimitRequestHandler | undefined;
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }
    if (!limiter) limiter = buildLimiter(options);
    return limiter(req, res, next);
  };
}

/** Global limiter applied to the whole API. */
export const globalLimiter = lazyLimiter();

/** Stricter limiter for auth endpoints to slow down brute-force attempts. */
export const authLimiter = lazyLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});
