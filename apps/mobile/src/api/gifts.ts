import { apiGet, apiPost } from './client';
import type { GiftItem } from '@/types';

export const giftsApi = {
  list: () => apiGet<{ items: GiftItem[] } | GiftItem[]>('/gifts'),
  send: (body: { giftId: string; toUserId: string; conversationId?: string }) =>
    apiPost<{ ok: boolean }>('/gifts/send', body),
};
