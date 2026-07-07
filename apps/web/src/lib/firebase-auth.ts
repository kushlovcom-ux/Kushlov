import { signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseAuth, googleProvider } from './firebase';

/** Open Google sign-in popup and return a fresh Firebase ID token. */
export async function signInWithGooglePopup(): Promise<string> {
  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user.getIdToken(true);
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
