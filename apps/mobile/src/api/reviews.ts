import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { HostReview, Paginated } from '@/types';

export const reviewsApi = {
  upsert: (body: { hostId: string; rating: number; text?: string }) =>
    apiPost<HostReview>('/reviews', body),
  update: (id: string, body: { rating?: number; text?: string }) =>
    apiPut<HostReview>(`/reviews/${id}`, body),
  remove: (id: string) => apiDelete<{ ok: boolean }>(`/reviews/${id}`),
  listForHost: (hostId: string, params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<HostReview>>(`/reviews/host/${hostId}`, { params }),
  mineForHost: (hostId: string) =>
    apiGet<HostReview | null>(`/reviews/mine/${hostId}`),
};
