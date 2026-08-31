import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/api/chat';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { getSocket } from '@/services/socket';

export function useConversations() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => chatApi.listConversations({ limit: 50 }),
    enabled: !!token,
    staleTime: 15_000,
    // Keep inbox fresh when sockets are down. Do not poll every few seconds
    // while the Messages tab stays mounted — that exhausted the API budget.
    refetchInterval: () => (getSocket()?.connected ? 60_000 : 20_000),
    refetchIntervalInBackground: false,
  });
}
