import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { env } from '@/config/env';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In via expo-auth-session.
 * Android requires a native Android OAuth client ID (not the web client ID).
 * Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID / EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 * and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (used to receive the ID token).
 */
export function useGoogleAuth() {
  const webClientId = env.googleWebClientId || undefined;
  const androidClientId = env.googleAndroidClientId || undefined;
  const iosClientId = env.googleIosClientId || undefined;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    iosClientId: iosClientId || webClientId,
    androidClientId,
  });

  const configured =
    !!webClientId &&
    (Platform.OS !== 'android' || !!androidClientId) &&
    (Platform.OS !== 'ios' || !!(iosClientId || webClientId));

  const idToken =
    response?.type === 'success'
      ? response.authentication?.idToken ??
        (response.params as { id_token?: string })?.id_token ??
        null
      : null;

  return {
    ready: !!request && configured,
    idToken,
    response,
    promptAsync,
    configured,
  };
}

export async function getGoogleIdToken(
  promptAsync: ReturnType<typeof Google.useAuthRequest>[2],
): Promise<string> {
  if (!env.googleWebClientId) {
    throw new Error('Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  if (Platform.OS === 'android' && !env.googleAndroidClientId) {
    throw new Error(
      'Google Sign-In needs EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (Android OAuth client from Google Cloud Console).',
    );
  }
  const result = await promptAsync();
  if (result.type !== 'success') {
    throw new Error('Google Sign-In was cancelled.');
  }
  const token =
    result.authentication?.idToken ??
    (result.params as { id_token?: string })?.id_token;
  if (!token) {
    throw new Error('No Google ID token received. Check OAuth client configuration.');
  }
  return token;
}

/** Hook helper to clear stale response after consuming idToken. */
export function useConsumeGoogleToken(
  idToken: string | null,
  onToken: (token: string) => void,
) {
  useEffect(() => {
    if (idToken) onToken(idToken);
  }, [idToken, onToken]);
}
