import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { env } from './env';
import { logger } from './logger';

/**
 * Vercel / dotenv often store PEMs as a single line with literal `\n`.
 * Also strip wrapping quotes and accept a pasted service-account JSON blob.
 */
export function normalizeFirebasePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key) as { private_key?: unknown };
      if (typeof parsed.private_key === 'string') key = parsed.private_key;
    } catch {
      /* keep original */
    }
  }
  return key.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
}

/** Strip quotes/whitespace so Vercel env values match token `aud`. */
export function normalizeFirebaseProjectId(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\r/g, '');
}

/** `firebase-adminsdk@<project>.iam.gserviceaccount.com` → project id. */
export function projectIdFromClientEmail(email?: string | null): string {
  const m = String(email ?? '')
    .trim()
    .match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
  return m?.[1] ?? '';
}

export function firebaseAdminProjectId(): string {
  const fromEnv = normalizeFirebaseProjectId(env.FIREBASE_PROJECT_ID);
  const fromEmail = projectIdFromClientEmail(env.FIREBASE_CLIENT_EMAIL);
  return fromEnv || fromEmail;
}

/**
 * Lazily initialize Firebase Admin from service-account env vars.
 * Uses dynamic import so the heavy firebase-admin package is never loaded
 * (or bundled at cold start) unless Google sign-in is actually used.
 *
 * Vercel (and some GCP runtimes) set GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT to
 * a different project than the Firebase web app. verifyIdToken then rejects a
 * valid token as the wrong audience. Force those env vars + `projectId` to match.
 */
export async function getFirebaseAuth(): Promise<Auth> {
  const projectId = firebaseAdminProjectId();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Firebase Admin is not configured');
  }

  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.GCLOUD_PROJECT = projectId;

  const { cert, deleteApp, getApp, getApps, initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  const existing = getApps()[0];
  if (existing && existing.options.projectId && existing.options.projectId !== projectId) {
    logger.warn(
      { existingProjectId: existing.options.projectId, expectedProjectId: projectId },
      'Reinitializing Firebase Admin with the configured project',
    );
    await deleteApp(existing);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: normalizeFirebasePrivateKey(privateKeyRaw),
      }),
      projectId,
    });
    logger.info({ firebaseProjectId: projectId }, 'Firebase Admin initialized');
  }

  return getAuth(getApp());
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseAdminProjectId() && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

type JwtPeek = { iss?: string; aud?: string | string[]; exp?: number };

/** Decode JWT payload without verifying. Never log the raw token. */
export function peekJwtPayload(token: string): JwtPeek | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as JwtPeek;
  } catch {
    return null;
  }
}

function tokenAudience(claims: JwtPeek | null): string {
  const aud = claims?.aud;
  if (Array.isArray(aud)) return String(aud[0] ?? '');
  return String(aud ?? '');
}

export function describeFirebaseTokenProblem(token: string): string | null {
  const trimmed = token.trim().replace(/^Bearer\s+/i, '');
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return 'Firebase ID token is missing';
  }
  if (trimmed.startsWith('ya29.') || trimmed.startsWith('ya29_')) {
    return 'Firebase ID token is missing';
  }
  const claims = peekJwtPayload(trimmed);
  if (!claims) {
    // Unusual encoding — let Admin SDK accept or reject the token.
    return null;
  }
  const iss = String(claims.iss ?? '');
  if (iss.includes('accounts.google.com')) {
    return 'Firebase ID token is missing';
  }
  const aud = tokenAudience(claims);
  const projectId = firebaseAdminProjectId();
  if (aud && projectId && aud !== projectId) {
    return 'Firebase project configuration mismatch';
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now() - 60_000) {
    return 'Authentication session expired';
  }
  return null;
}

/**
 * Verify a Firebase ID token. Does not check revocation — that extra Admin API
 * call is a common source of false "invalid token" failures on serverless.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const token = idToken.trim().replace(/^Bearer\s+/i, '');
  const auth = await getFirebaseAuth();
  return auth.verifyIdToken(token, false);
}
