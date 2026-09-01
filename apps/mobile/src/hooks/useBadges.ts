import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { getSocket } from '@/services/socket';
import { setAppBadgeCount } from '@/services/notifications';

/** Unread message / notification counts for badges. */
export function useBadges() {
  const token = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: queryKeys.badges,
    queryFn: () => usersApi.badges(),
    enabled: !!token,
    // Socket events already invalidate this. Poll only when realtime is down.
    refetchInterval: () => (getSocket()?.connected ? 90_000 : 45_000),
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!token) {
      void setAppBadgeCount(0);
      return;
    }
    const unread =
      (query.data?.unreadNotifications ?? query.data?.notifications ?? 0) +
      (query.data?.unreadMessages ?? query.data?.messages ?? 0);
    void setAppBadgeCount(unread);
  }, [token, query.data]);

  return query;
}
