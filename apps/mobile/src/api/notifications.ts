import { apiGet, apiPatch } from './client';
import type { AppNotification, Paginated } from '@/types';

function normalizeNotification(raw: Record<string, unknown>): AppNotification {
  const id =
    (raw.id as string) ||
    (typeof raw._id === 'string' ? raw._id : (raw._id as { toString?: () => string })?.toString?.()) ||
    '';
  return {
    id,
    type: raw.type as AppNotification['type'],
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    data: (raw.data as Record<string, unknown>) || undefined,
    isRead: Boolean(raw.isRead),
    readAt: raw.isRead ? new Date().toISOString() : undefined,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export const notificationsApi = {
  list: async (params?: { page?: number; limit?: number }) => {
    const res = await apiGet<Paginated<Record<string, unknown>> & { unread?: number }>(
      '/notifications',
      { params },
    );
    return {
      ...res,
      items: (res.items ?? []).map((n) => normalizeNotification(n)),
    };
  },
  markRead: (id: string) => apiPatch<{ ok: boolean }>(`/notifications/${id}/read`),
  markAllRead: () => apiPatch<{ ok: boolean }>('/notifications/read-all'),
};
