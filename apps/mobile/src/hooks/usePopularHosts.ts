import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';

export function usePopularHosts() {
  return useQuery({
    queryKey: queryKeys.popularHosts,
    queryFn: async () => {
      const data = await settingsApi.popularHosts();
      return data.items ?? [];
    },
    staleTime: 60_000,
  });
}

export function useTopRatedHosts() {
  return useQuery({
    queryKey: queryKeys.topRatedHosts,
    queryFn: () => usersApi.topRatedHosts({ limit: 20 }),
    staleTime: 60_000,
  });
}
