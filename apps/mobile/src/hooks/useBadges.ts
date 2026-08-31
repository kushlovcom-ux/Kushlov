import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { getSocket } from '@/services/socket';

/** Unread message / notification counts for badges. */
export function useBadges() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: () => usersApi.badges(),
    enabled: !!token,
    // Socket events already invalidate this. Poll only when realtime is down.
    refetchInterval: () => (getSocket()?.connected ? 90_000 : 45_000),
    refetchIntervalInBackground: false,
  });
}
