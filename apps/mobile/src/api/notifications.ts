import { apiGet, apiPatch } from './client';
import type { AppNotification, Paginated } from '@/types';

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<AppNotification>>('/notifications', { params }),
  markRead: (id: string) => apiPatch<{ ok: boolean }>(`/notifications/${id}/read`),
  markAllRead: () => apiPatch<{ ok: boolean }>('/notifications/read-all'),
};
