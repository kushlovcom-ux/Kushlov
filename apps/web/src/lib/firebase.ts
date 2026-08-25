import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';
import { clientEnv, isFirebaseClientConfigured } from './env';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

/** Lazily initialize Firebase client SDK (browser only). */
export function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client is only available in the browser');
  }
  if (!isFirebaseClientConfigured()) {
    throw new Error('Firebase client is not configured');
  }
  if (!firebaseApp) {
    firebaseApp = getApps()[0] ?? initializeApp(clientEnv.firebase);
  }
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth is only available in the browser');
  }
  if (!firebaseAuth) {
    const app = getFirebaseApp();
    try {
      firebaseAuth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      firebaseAuth = getAuth(app);
    }
  }
  return firebaseAuth;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });
