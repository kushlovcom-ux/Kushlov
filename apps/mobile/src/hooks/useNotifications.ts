import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';

export function useNotifications() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsApi.list({ limit: 50 }),
    enabled: !!token,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
    },
  });

  return { list, markRead, markAllRead };
}
