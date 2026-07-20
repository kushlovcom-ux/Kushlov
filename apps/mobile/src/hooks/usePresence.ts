import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/auth';

/** Pings /users/me/presence while authenticated and app is active. */
export function usePresence(intervalMs = 45_000) {
  const token = useAuthStore((s) => s.accessToken);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    const ping = () => {
      usersApi.pingPresence().catch(() => undefined);
    };

    ping();
    timer.current = setInterval(ping, intervalMs);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ping();
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
    };
  }, [token, intervalMs]);
}
