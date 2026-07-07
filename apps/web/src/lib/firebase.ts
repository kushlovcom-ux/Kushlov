import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { clientEnv, isFirebaseClientConfigured } from './env';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

/** Lazily initialize Firebase client SDK (browser only). */
export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error('Firebase client is not configured');
  }
  if (!firebaseApp) {
    firebaseApp = getApps()[0] ?? initializeApp(clientEnv.firebase);
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    firebaseAuth = getAuth(getFirebaseApp());
  }
  return firebaseAuth;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
