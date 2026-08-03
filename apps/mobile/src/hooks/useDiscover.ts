import { useInfiniteQuery } from '@tanstack/react-query';
import { usersApi, type SearchUsersParams } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';

export function useDiscover(
  params: SearchUsersParams = {},
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useInfiniteQuery({
    queryKey: queryKeys.discover(params),
    queryFn: ({ pageParam = 1 }) =>
      usersApi.search({ ...params, page: pageParam, limit: params.limit ?? 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: options?.enabled ?? true,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchInterval: options?.refetchInterval ?? false,
  });
}
