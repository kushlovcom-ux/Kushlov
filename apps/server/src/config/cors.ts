import type { CorsOptions } from 'cors';
import { env } from './env';
import { logger } from './logger';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/** Local dev servers (Next.js on :3000, etc.). */
export function isLocalDevOrigin(origin: string): boolean {
  return LOCAL_DEV_ORIGIN.test(origin.replace(/\/$/, ''));
}

/** Allowed browser origins for credentialed CORS (cookies + Authorization). */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

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

  // Allow Vercel production + preview frontends (*.vercel.app).
  if (/^https:\/\/[\w.-]+\.vercel\.app$/i.test(normalized)) {
    return true;
  }

  return env.CORS_ORIGINS.split(',').some((o) => o.trim() === '*');
}

/** Shared CORS options — used for both preflight (OPTIONS) and normal requests. */
export const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (isOriginAllowed(origin)) return cb(null, origin);
    logger.warn({ origin }, 'CORS blocked origin');
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};
