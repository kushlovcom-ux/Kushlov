import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { focusManager, useQueryClient } from '@tanstack/react-query';
import { refreshAccessToken } from '@/api/client';
import { connectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { accessTokenMsRemaining } from '@/utils/jwt';

const REFRESH_WHEN_REMAINING_MS = 90_000;

async function refreshIfExpiringSoon(): Promise<void> {
  const remaining = accessTokenMsRemaining(useAuthStore.getState().accessToken);
  if (remaining === null || remaining > REFRESH_WHEN_REMAINING_MS) return;
  const next = await refreshAccessToken();
  if (next) connectSocket(next);
}

/**
 * Keeps the session alive while the app is in use, and recovers failed screens
 * after a rate-limit / network blip (common after several minutes of browsing).
 */
export function useSessionKeepAlive() {
  const qc = useQueryClient();

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      focusManager.setFocused(state === 'active');
      if (state !== 'active') return;
      void (async () => {
        await refreshIfExpiringSoon();
        await qc.refetchQueries({
          type: 'active',
          predicate: (query) => query.state.status === 'error',
        });
      })();
    };

    focusManager.setFocused(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [qc]);

  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void refreshIfExpiringSoon();
    }, 30_000);
    return () => clearInterval(id);
  }, [token]);
}
