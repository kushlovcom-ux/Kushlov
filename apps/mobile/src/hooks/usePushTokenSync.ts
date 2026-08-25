import { useEffect } from 'react';
import { usersApi } from '@/api/users';
import { registerForPushNotifications } from '@/services/notifications';
import { useAuthStore } from '@/store/auth';

/** After login, fetch an Expo push token and store it on the user so the server can notify a closed app. */
export function usePushTokenSync() {
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const pushToken = await registerForPushNotifications();
      if (!pushToken || cancelled) return;
      try {
        await usersApi.registerPushToken(pushToken);
      } catch {
        /* optional — overlay/socket still work */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
}
