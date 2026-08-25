import jwt from 'jsonwebtoken';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { env } from './env';

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

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseAdminProjectId());
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

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let googleCertsCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleSecureTokenCerts(): Promise<Record<string, string>> {
  if (googleCertsCache && Date.now() < googleCertsCache.expiresAt) {
    return googleCertsCache.certs;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Could not fetch Firebase public keys (${res.status})`);
  }
  const certs = (await res.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/i.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  googleCertsCache = {
    certs,
    expiresAt: Date.now() + Math.max(60, maxAge - 60) * 1000,
  };
  return certs;
}

/**
 * Verify a Firebase ID token with Google's public certs (not firebase-admin
 * verifyIdToken). That Admin call uses GCLOUD_PROJECT / the default app audience
 * and fails on Vercel and some VPS images even when the token is valid.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const token = idToken.trim().replace(/^Bearer\s+/i, '');
  const projectId = firebaseAdminProjectId();
  if (!projectId) {
    throw new Error('Firebase Admin is not configured');
  }

  const headerJson = token.split('.')[0];
  if (!headerJson) {
    throw new Error('Firebase ID token is missing');
  }
  let kid: string | undefined;
  try {
    const header = JSON.parse(Buffer.from(headerJson, 'base64url').toString('utf8')) as {
      kid?: string;
    };
    kid = header.kid;
  } catch {
    throw new Error('Firebase ID token verification failed');
  }

  const certs = await getGoogleSecureTokenCerts();
  const pem = kid ? certs[kid] : undefined;
  if (!pem) {
    throw new Error('Firebase ID token verification failed');
  }

  const payload = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    clockTolerance: 60,
  }) as jwt.JwtPayload & {
    user_id?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  const uid = String(payload.user_id ?? payload.sub ?? '');
  if (!uid) {
    throw new Error('Firebase ID token verification failed');
  }

  return {
    ...payload,
    uid,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  } as DecodedIdToken;
}
