import { env } from './env';

/** Allowed browser origins for credentialed CORS (cookies + Authorization). */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

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
  if (getAllowedOrigins().includes(normalized)) return true;

  // Allow Vercel production + preview frontends (*.vercel.app).
  if (process.env.VERCEL && /^https:\/\/[\w.-]+\.vercel\.app$/i.test(normalized)) {
    return true;
  }

  return env.CORS_ORIGINS.split(',').some((o) => o.trim() === '*');
}

export const corsOrigins = getAllowedOrigins();
