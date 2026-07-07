import type { Auth } from 'firebase-admin/auth';
import { env } from './env';

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
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  return getAuth(getApp());
}

export function isFirebaseConfigured(): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}
