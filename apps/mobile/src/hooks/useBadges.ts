import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';

/** Unread message / notification counts for badges. */
export function useBadges() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: () => usersApi.badges(),
    enabled: !!token,
    refetchInterval: 8_000,
  });
}
