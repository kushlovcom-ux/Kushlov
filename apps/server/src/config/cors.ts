import type { NextFunction, Request, Response } from 'express';
import { env } from './env';
import { logger } from './logger';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/** Known production frontends (also allow any *.vercel.app preview). */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://kushlov-web.vercel.app',
  'https://kushlov-server.vercel.app',
];

/** Local dev servers (Next.js on :3000, etc.). */
export function isLocalDevOrigin(origin: string): boolean {
  return LOCAL_DEV_ORIGIN.test(origin.replace(/\/$/, ''));
}

/** Allowed browser origins for credentialed CORS (cookies + Authorization). */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>(DEFAULT_ORIGINS);

  for (const entry of env.CORS_ORIGINS.split(',')) {
    const trimmed = entry.trim().replace(/\/$/, '');
    if (trimmed && trimmed !== '*') origins.add(trimmed);
  }

  const client = env.CLIENT_URL?.trim().replace(/\/$/, '');
  if (client) origins.add(client);

  return [...origins];
}

/** True when the request Origin header may call this API with credentials. */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');

  if (isLocalDevOrigin(normalized)) return true;
  if (getAllowedOrigins().includes(normalized)) return true;

  // Vercel production + preview frontends (*.vercel.app).
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(normalized)) {
    return true;
  }

  return env.CORS_ORIGINS.split(',').some((o) => o.trim() === '*');
}

/** Set CORS response headers when the origin is allowed. */
export function applyCorsHeaders(req: Request, res: Response): boolean {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    return true;
  }

  if (!origin) return true;
  return false;
}

/**
 * First middleware — handles preflight immediately and sets CORS on every response.
 * Required for Vercel serverless where errors/rewrites can skip the cors package.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowed = applyCorsHeaders(req, res);

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept',
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    if (!allowed && req.headers.origin) {
      logger.warn({ origin: req.headers.origin }, 'CORS preflight blocked');
      res.status(403).end();
      return;
    }
    res.status(204).end();
    return;
  }

  if (!allowed && req.headers.origin) {
    logger.warn({ origin: req.headers.origin }, 'CORS blocked origin');
    res.status(403).json({ success: false, message: 'CORS origin not allowed' });
    return;
  }

  next();
}
