'use client';

import { useEffect } from 'react';
import { api, refreshAccessToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/**
 * Restore session on load: validate access token or silently refresh (cookie + stored
 * refresh token) so users stay signed in for up to 30 days.
 */
export function AuthBootstrap() {
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function restoreSession() {
      const store = useAuthStore.getState();

      try {
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
        // Transient refresh failure: keep persisted tokens — do not wipe the session.
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
