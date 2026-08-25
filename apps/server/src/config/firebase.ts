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

/**
 * Lazily initialize Firebase Admin from service-account env vars.
 * Uses dynamic import so the heavy firebase-admin package is never loaded
 * (or bundled at cold start) unless Google sign-in is actually used.
 */
export async function getFirebaseAuth(): Promise<Auth> {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase Admin is not configured');
  }

  const { cert, getApp, getApps, initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizeFirebasePrivateKey(env.FIREBASE_PRIVATE_KEY),
      }),
    });
    logger.info(
      { firebaseProjectId: env.FIREBASE_PROJECT_ID },
      'Firebase Admin initialized',
    );
  }

  return getAuth(getApp());
}

export function isFirebaseConfigured(): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

type JwtPeek = { iss?: string; aud?: string; exp?: number };

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

export function describeFirebaseTokenProblem(token: string): string | null {
  const trimmed = token.trim();
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
  const aud = String(claims.aud ?? '');
  if (aud && env.FIREBASE_PROJECT_ID && aud !== env.FIREBASE_PROJECT_ID) {
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
  const auth = await getFirebaseAuth();
  return auth.verifyIdToken(idToken, false);
}
