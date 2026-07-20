import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/api/chat';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';

export function useConversations() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => chatApi.listConversations({ limit: 50 }),
    enabled: !!token,
    refetchInterval: 20_000,
  });
}
