import { api, apiDelete, apiGet, apiPost } from './client';
import type { Paginated, PublicUser } from '@/types';

export const moderationApi = {
  report: async (payload: {
    userId: string;
    reason: string;
    details?: string;
    evidenceUris?: string[];
  }) => {
    const form = new FormData();
    form.append('userId', payload.userId);
    form.append('reason', payload.reason);
    if (payload.details) form.append('details', payload.details);
    (payload.evidenceUris ?? []).forEach((uri, i) => {
      form.append('evidence', {
        uri,
        type: 'image/jpeg',
        name: `evidence-${i}.jpg`,
      } as unknown as Blob);
    });
    const res = await api.post('/moderation/report', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as { id: string };
  },
  block: (userId: string) => apiPost<{ ok: boolean }>(`/moderation/block/${userId}`),
  unblock: (userId: string) => apiDelete<{ ok: boolean }>(`/moderation/block/${userId}`),
  listBlocks: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PublicUser>>('/moderation/blocks', { params }),
};
