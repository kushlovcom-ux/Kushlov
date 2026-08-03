import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { env } from '@/config/env';
import { getFirebaseAuth, isFirebaseClientConfigured } from '@/services/firebase';

/**
 * Native Google Sign-In → Firebase Auth → Firebase ID token for POST /auth/google.
 *
 * Backend uses Firebase Admin `verifyIdToken`, so a raw Google OAuth ID token
 * is rejected. We exchange the Google token for a Firebase credential first.
 *
 * Requires:
 * - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Web client — needed for Google idToken)
 * - EXPO_PUBLIC_FIREBASE_* client config
 * - Android OAuth client with package com.kushlov.app + EAS SHA-1
 * - Rebuild after native Google Sign-In module changes
 */
function configureGoogleSignIn() {
  if (!env.googleWebClientId) return;
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId || undefined,
    offlineAccess: false,
  });
}

export function useGoogleAuth() {
  const configured = useMemo(() => {
    if (!env.googleWebClientId) return false;
    if (!isFirebaseClientConfigured()) return false;
    // Native Android matching uses package + SHA-1; android client ID still required in Cloud Console.
    if (Platform.OS === 'android' && !env.googleAndroidClientId) return false;
    return true;
  }, []);

  useEffect(() => {
    if (configured) configureGoogleSignIn();
  }, [configured]);

  return {
    ready: configured,
    configured,
    /** Kept for LoginScreen compatibility — unused by native SDK. */
    promptAsync: undefined as undefined,
  };
}

/**
 * Sign in with Google, exchange for a Firebase session, and return a Firebase ID token
 * suitable for `POST /auth/google` (`auth.verifyIdToken`).
 */
export async function getFirebaseIdTokenFromGoogle(): Promise<string> {
  if (!env.googleWebClientId) {
    throw new Error('Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      'Firebase is not configured. Set EXPO_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, and APP_ID.',
    );
  }
  if (Platform.OS === 'android' && !env.googleAndroidClientId) {
    throw new Error(
      'Google Sign-In needs EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID and a rebuild with the native Google Sign-In module.',
    );
  }

  configureGoogleSignIn();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new Error('Google Sign-In was cancelled.');
    }

    let googleIdToken = response.data.idToken;
    if (!googleIdToken) {
      const tokens = await GoogleSignin.getTokens();
      googleIdToken = tokens.idToken;
    }
    if (!googleIdToken) {
      throw new Error(
        'No Google ID token received. Confirm EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is your Web client ID and the Android client has the correct package + SHA-1.',
      );
    }

    const credential = GoogleAuthProvider.credential(googleIdToken);
    const userCredential = await signInWithCredential(getFirebaseAuth(), credential);
    const firebaseIdToken = await userCredential.user.getIdToken(true);
    if (!firebaseIdToken) {
      throw new Error('Failed to obtain Firebase ID token after Google Sign-In.');
    }
    return firebaseIdToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Google Sign-In was cancelled.');
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new Error('Google Sign-In is already in progress.');
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is required for Google Sign-In on Android.');
      }
    }
    throw err instanceof Error ? err : new Error('Google Sign-In failed.');
  }
}

/** @deprecated Use getFirebaseIdTokenFromGoogle — name kept for call-site clarity during migration. */
export const getGoogleIdToken = getFirebaseIdTokenFromGoogle;
