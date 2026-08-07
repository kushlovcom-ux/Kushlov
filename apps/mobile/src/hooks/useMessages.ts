import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/api/chat';
import { queryKeys } from '@/constants/queryKeys';

export function useMessages(conversationId: string) {
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam = 1 }) =>
      chatApi.getMessages(conversationId, { page: pageParam, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: !!conversationId,
    // Fallback when Socket.io is unavailable (e.g. Vercel API host).
    refetchInterval: conversationId ? 3_000 : false,
    refetchIntervalInBackground: false,
  });

  const send = useMutation({
    mutationFn: (payload: {
      text?: string;
      type?: string;
      fileUri?: string;
      mimeType?: string;
      fileName?: string;
    }) => chatApi.sendMessage(conversationId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });

  const markRead = useMutation({
    mutationFn: () => chatApi.markRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
    },
  });

  return { ...query, send, markRead };
}
