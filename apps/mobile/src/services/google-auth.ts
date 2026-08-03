import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { env } from '@/config/env';

/**
 * Native Google Sign-In (Play Services / iOS SDK).
 * Browser custom-URI OAuth is blocked by Google on Android ("invalid_request").
 *
 * Requires:
 * - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Web client — needed for idToken / Firebase)
 * - Android OAuth client in Cloud Console with package com.kushlov.app + EAS SHA-1
 * - Rebuild after adding @react-native-google-signin/google-signin
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

export async function getGoogleIdToken(): Promise<string> {
  if (!env.googleWebClientId) {
    throw new Error('Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
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

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      throw new Error(
        'No Google ID token received. Confirm EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is your Web client ID and the Android client has the correct package + SHA-1.',
      );
    }
    return idToken;
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
