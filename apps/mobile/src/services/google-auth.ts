import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { env } from '@/config/env';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In via expo-auth-session.
 * Returns an idToken suitable for POST /auth/google.
 * Requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and iOS/Android client IDs in production).
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: env.googleWebClientId || undefined,
    iosClientId: env.googleWebClientId || undefined,
    androidClientId: env.googleWebClientId || undefined,
  });

  const idToken =
    response?.type === 'success'
      ? response.authentication?.idToken ??
        (response.params as { id_token?: string })?.id_token ??
        null
      : null;

  return {
    ready: !!request && !!env.googleWebClientId,
    idToken,
    response,
    promptAsync,
  };
}

export async function getGoogleIdToken(
  promptAsync: ReturnType<typeof Google.useAuthRequest>[2],
): Promise<string> {
  if (!env.googleWebClientId) {
    throw new Error('Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
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
