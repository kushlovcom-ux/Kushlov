import { apiDelete, apiGet, apiPost } from './client';
import type { Paginated, PublicUser } from '@/types';

export const socialApi = {
  like: (userId: string) =>
    apiPost<{ matched?: boolean; like?: unknown }>(`/social/like/${userId}`),
  unlike: (userId: string) => apiDelete<{ ok: boolean }>(`/social/like/${userId}`),
  matches: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PublicUser>>('/social/matches', { params }),
  likes: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PublicUser>>('/social/likes', { params }),
  follow: (userId: string) => apiPost<{ ok: boolean }>(`/social/follow/${userId}`),
  unfollow: (userId: string) => apiDelete<{ ok: boolean }>(`/social/follow/${userId}`),
  following: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PublicUser>>('/social/following', { params }),
};
