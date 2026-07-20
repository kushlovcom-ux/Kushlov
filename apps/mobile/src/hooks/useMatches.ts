import { useQuery } from '@tanstack/react-query';
import { socialApi } from '@/api/social';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';

export function useMatches() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: () => socialApi.matches({ limit: 50 }),
    enabled: !!token,
  });
}

export function useLikes() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.likes,
    queryFn: () => socialApi.likes({ limit: 50 }),
    enabled: !!token,
  });
}
