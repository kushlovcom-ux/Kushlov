import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signOut, type Auth } from 'firebase/auth';
import { env } from '@/config/env';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    env.firebase.apiKey &&
      env.firebase.authDomain &&
      env.firebase.projectId &&
      env.firebase.appId,
  );
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      'Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_* in .env / EAS env.',
    );
  }
  if (!firebaseApp) {
    firebaseApp = getApps()[0] ?? initializeApp(env.firebase);
  }
  return firebaseApp;
}

/** Firebase Auth used only to mint ID tokens for POST /auth/google. */
export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    firebaseAuth = getAuth(getFirebaseApp());
  }
  return firebaseAuth;
}

/** Clear Firebase session (safe if never signed in with Google). */
export async function signOutFirebase(): Promise<void> {
  try {
    if (!isFirebaseClientConfigured()) return;
    const auth = getFirebaseAuth();
    if (auth.currentUser) await signOut(auth);
  } catch {
    /* JWT logout still proceeds */
  }
}
