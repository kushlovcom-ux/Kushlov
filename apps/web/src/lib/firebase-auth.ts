import { signInWithPopup, signOut } from 'firebase/auth';
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
  const iss = String(payload.iss ?? '');
  return iss.includes('securetoken.google.com');
}

/** Open Google sign-in popup and return a fresh Firebase ID token (not a Google OAuth token). */
export async function signInWithGooglePopup(): Promise<string> {
  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  if (!user) {
    throw new Error('Google authentication failed');
  }
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

/** Sign out of the Firebase session (safe if not signed in with Google). */
export async function signOutFirebase(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) await signOut(auth);
  } catch {
    /* ignore — JWT logout still proceeds */
  }
}
