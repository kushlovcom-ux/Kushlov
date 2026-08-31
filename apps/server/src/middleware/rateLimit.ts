import type { Request, Response } from 'express';
import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';

const FRIENDLY_429 =
  "You've made several requests in a short time. Please wait a moment and try again.";

/** Normalize IPv4-mapped IPv6 so the same client isn't counted twice. */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.accessToken) return req.cookies.accessToken as string;
  return null;
}

/** Prefer authenticated user id; fall back to client IP (via trust proxy). */
export function clientKey(req: Request): string {
  const token = extractBearer(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      if (payload?.sub) return `u:${payload.sub}`;
    } catch {
      // Expired/invalid signature — still attribute the budget to the subject
      // so a 15m token expiry doesn't dump the user onto the tiny IP bucket.
      const decoded = jwt.decode(token);
      if (decoded && typeof decoded === 'object' && typeof decoded.sub === 'string') {
        return `u:${decoded.sub}`;
      }
    }
  }
  return `ip:${normalizeIp(req.ip)}`;
}

function ipOnlyKey(req: Request): string {
  return `ip:${normalizeIp(req.ip)}`;
}

function pathOf(req: Request): string {
  return (req.originalUrl || req.url || '').split('?')[0];
}

function shouldSkipGlobal(req: Request): boolean {
  if (req.method === 'OPTIONS') return true;
  const path = pathOf(req);
  // Payment provider retries must not be blocked by IP limits.
  if (path === '/api/payments/webhook' || path.endsWith('/payments/webhook')) return true;
  // Refresh has its own limiter. Blocking it here logs the user out of every screen.
  if (path === '/api/auth/refresh' || path.endsWith('/auth/refresh')) return true;
  // Heartbeat — cheap and frequent; must not consume the browsing budget.
  if (path.endsWith('/users/me/presence')) return true;
  if (path === '/health' || path.endsWith('/health')) return true;
  return false;
}

/**
 * Logged-in clients (mobile tabs + polling) easily exceed a 300/15m cap.
 * Keep RATE_LIMIT_MAX for anonymous IPs; floor authenticated users higher so
 * a stale production env of 300 cannot freeze the app after a few minutes.
 */
const AUTH_GLOBAL_FLOOR = 2000;

function globalMax(req: Request): number {
  const configured = env.RATE_LIMIT_MAX;
  if (clientKey(req).startsWith('u:')) {
    return Math.max(configured, AUTH_GLOBAL_FLOOR);
  }
  return configured;
}

function retryAfterSeconds(res: Response, windowMs: number): number {
  const reset = res.getHeader('RateLimit-Reset');
  if (typeof reset === 'string' || typeof reset === 'number') {
    const n = Number(reset);
    if (Number.isFinite(n) && n > 0) {
      // express-rate-limit v7 may send epoch seconds or remaining seconds
      if (n > 1_000_000_000) return Math.max(1, n - Math.floor(Date.now() / 1000));
      return Math.max(1, Math.ceil(n));
    }
  }
  const retry = res.getHeader('Retry-After');
  if (typeof retry === 'string' || typeof retry === 'number') {
    const n = Number(retry);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function createStore(prefix: string): Options['store'] | undefined {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    return new RedisStore({
      prefix,
      // ioredis supports Redis command arrays via .call(...)
      sendCommand: (...args: string[]) =>
        (redis.call as (...a: string[]) => unknown).apply(redis, args),
    });
  } catch (err) {
    logger.warn(
      { prefix, err: err instanceof Error ? err.message : String(err) },
      'rate-limit-redis unavailable, using memory store',
    );
    return undefined;
  }
}

type BuildOpts = Partial<Options> & {
  /** Unique Redis key prefix (required when using Redis). */
  name: string;
  windowMs: number;
  max: Options['max'];
};

/**
 * Build a rate limiter backed by Redis when available (shared across PM2 workers /
 * instances), otherwise the default in-memory store.
 *
 * Limiters must be created at app initialization (not inside a request handler).
 */
function buildLimiter(opts: BuildOpts): RateLimitRequestHandler {
  const { name, windowMs, max, ...rest } = opts;
  const store = createStore(`rl:${name}:`);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    keyGenerator: clientKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: (req, res, _next, options) => {
      const retryAfterSec = retryAfterSeconds(res, windowMs);
      res.setHeader('Retry-After', String(retryAfterSec));
      logger.warn(
        {
          event: 'rate_limit_exceeded',
          limiter: name,
          route: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userId: (() => {
            try {
              const t = extractBearer(req);
              return t ? verifyAccessToken(t).sub : undefined;
            } catch {
              return undefined;
            }
          })(),
          limit: options.limit,
          windowMs,
          retryAfterSec,
          remaining: res.getHeader('RateLimit-Remaining'),
          timestamp: new Date().toISOString(),
        },
        'Rate limit exceeded',
      );
      res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: FRIENDLY_429,
        retryAfterSec,
      });
    },
    ...rest,
  });
}

/** Global API limiter — normal authenticated browsing (excludes webhooks). */
export const globalLimiter = buildLimiter({
  name: 'global',
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: globalMax,
  skip: shouldSkipGlobal,
});

/** Login / Google OAuth — brute-force protection. */
export const loginLimiter = buildLimiter({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: ipOnlyKey,
});

/** Registration spam protection. */
export const registerLimiter = buildLimiter({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: ipOnlyKey,
});

/** Password reset / forgot — email abuse protection. */
export const passwordResetLimiter = buildLimiter({
  name: 'password-reset',
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: ipOnlyKey,
});

/** Refresh-token storms (multi-tab). */
export const refreshLimiter = buildLimiter({
  name: 'refresh',
  windowMs: 15 * 60 * 1000,
  max: 100,
});

/** Discover / user search. */
export const searchLimiter = buildLimiter({
  name: 'search',
  windowMs: 60 * 1000,
  max: 100,
});

/** Chat message sends (HTTP). */
export const messageLimiter = buildLimiter({
  name: 'messages',
  windowMs: 60 * 1000,
  max: 120,
});

/** Likes / follows write actions. */
export const likeLimiter = buildLimiter({
  name: 'likes',
  windowMs: 60 * 1000,
  max: 60,
});

/** Contact / support form. */
export const contactLimiter = buildLimiter({
  name: 'contact',
  windowMs: 60 * 60 * 1000,
  max: 10,
});

/** Review create/update. */
export const reviewWriteLimiter = buildLimiter({
  name: 'reviews',
  windowMs: 15 * 60 * 1000,
  max: 30,
});

/**
 * @deprecated Prefer loginLimiter / registerLimiter / passwordResetLimiter.
 * Kept as an alias for any leftover imports.
 */
export const authLimiter = loginLimiter;
