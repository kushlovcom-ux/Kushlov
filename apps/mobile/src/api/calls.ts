import { apiGet, apiPost } from './client';
import { normalizeCallSession } from '@/utils/normalizeCall';
import type { CallSession, CallType, Paginated } from '@/types';

export const callsApi = {
  initiate: async (body: {
    type: CallType;
    calleeId?: string;
    participantIds?: string[];
  }) => {
    const raw = await apiPost<unknown>('/calls/initiate', body);
    return normalizeCallSession(raw);
  },
  invite: (type: CallType | string, id: string, userId: string) =>
    apiPost<{ ok?: boolean }>(`/calls/${type}/${id}/invite`, { userId }),
  incoming: async () => {
    const res = await apiGet<{ items: unknown[] }>('/calls/incoming');
    return { items: (res.items ?? []).map((i) => normalizeCallSession(i)) };
  },
  history: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<CallSession>>('/calls/history', { params }),
  get: async (type: CallType | string, id: string) =>
    normalizeCallSession(await apiGet<unknown>(`/calls/${type}/${id}`)),
  accept: async (type: CallType | string, id: string) =>
    normalizeCallSession(await apiPost<unknown>(`/calls/${type}/${id}/accept`)),
  reject: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/reject`),
  end: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/end`),
};
