'use client';

import { useEffect } from 'react';
import { DEFAULT_COUNTRY } from '@kushlov/utils';
import { api, refreshAccessToken } from '@/lib/api';
import { completeGoogleRedirectIfPresent } from '@/lib/firebase-auth';
import { isFirebaseClientConfigured } from '@/lib/env';
import { useAuthStore } from '@/store/auth';

/**
 * Restore session on load: Google redirect result, valid access token, or silent refresh.
 */
export function AuthBootstrap() {
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function restoreSession() {
      const store = useAuthStore.getState();

      try {
        if (isFirebaseClientConfigured()) {
          try {
            const firebaseIdToken = await completeGoogleRedirectIfPresent();
            if (firebaseIdToken && !cancelled) {
              const res = await api.post('/auth/google', {
                idToken: firebaseIdToken,
                country: store.user?.country ?? DEFAULT_COUNTRY,
              });
              const data = res.data.data as {
                user: Parameters<typeof store.setAuth>[0];
                accessToken: string;
                refreshToken: string;
              };
              store.setAuth(data.user, data.accessToken, data.refreshToken);
              return;
            }
          } catch {
            /* not returning from Google, or exchange failed — continue restore */
          }
        }

        if (store.accessToken) {
          try {
            const res = await api.get('/auth/me');
            if (!cancelled) store.setUser(res.data.data);
            return;
          } catch {
            // Access token expired — try refresh below.
          }
        }

        const token = await refreshAccessToken();
        if (token && !cancelled) {
          const res = await api.get('/auth/me');
          store.setAuth(res.data.data, token, useAuthStore.getState().refreshToken);
        }
      } finally {
        if (!cancelled) store.setSessionChecked(true);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  return null;
}
