import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { clientEnv } from './env';
import { getFirebaseAuth, googleProvider } from './firebase';

function decodeJwtPayload(token: string): { iss?: string; aud?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as { iss?: string; aud?: string };
  } catch {
    return null;
  }
}

function isFirebaseIdToken(token: string): boolean {
  if (!token || token === 'undefined' || token === 'null') return false;
  if (token.split('.').length !== 3) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  return String(payload.iss ?? '').includes('securetoken.google.com');
}

async function idTokenFromUser(user: { getIdToken: (force?: boolean) => Promise<string> }) {
  const firebaseIdToken = await user.getIdToken(true);
  if (!isFirebaseIdToken(firebaseIdToken)) {
    throw new Error('Firebase ID token is missing');
  }
  if (process.env.NODE_ENV !== 'production') {
    const expected = clientEnv.firebase.projectId;
    const payload = decodeJwtPayload(firebaseIdToken);
    console.info('[auth] Frontend Firebase project:', expected, 'token aud:', payload?.aud);
  }
  return firebaseIdToken;
}

/** Finish Google redirect sign-in after returning from accounts.google.com. */
export async function completeGoogleRedirectIfPresent(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  return idTokenFromUser(result.user);
}

function shouldFallbackToRedirect(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/internal-error' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/argument-error'
  );
}

/**
 * Google sign-in: popup first (needs COOP same-origin-allow-popups).
 * If the popup cannot talk to this window, fall back to a full-page redirect.
 */
export async function signInWithGooglePopup(): Promise<string> {
  const auth = getFirebaseAuth();

  const redirected = await completeGoogleRedirectIfPresent();
  if (redirected) return redirected;

  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user) {
      throw new Error('Google authentication failed');
    }
    return idTokenFromUser(result.user);
  } catch (err) {
    if (shouldFallbackToRedirect(err)) {
      await signInWithRedirect(auth, googleProvider);
      return new Promise(() => undefined);
    }
    throw err;
  }
}

/** Sign out of the Firebase session (safe if not signed in with Google). */
export async function signOutFirebase(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) await signOut(auth);
  } catch {
    /* ignore — JWT logout still proceeds */
  }
}
