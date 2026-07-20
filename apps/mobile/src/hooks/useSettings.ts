import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import { queryKeys } from '@/constants/queryKeys';

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsApi.get(),
    staleTime: 5 * 60_000,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => settingsApi.stats(),
    staleTime: 60_000,
  });
}
