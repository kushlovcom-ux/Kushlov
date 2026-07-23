import { apiGet, apiPost } from './client';
import type { CallSession, CallType, Paginated } from '@/types';

export const callsApi = {
  initiate: (body: {
    type: CallType;
    calleeId?: string;
    participantIds?: string[];
  }) => apiPost<CallSession>('/calls/initiate', body),
  invite: (type: CallType | string, id: string, userId: string) =>
    apiPost<{ ok?: boolean }>(`/calls/${type}/${id}/invite`, { userId }),
  incoming: () => apiGet<{ items: CallSession[] }>('/calls/incoming'),
  history: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<CallSession>>('/calls/history', { params }),
  get: (type: CallType | string, id: string) =>
    apiGet<CallSession>(`/calls/${type}/${id}`),
  accept: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/accept`),
  reject: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/reject`),
  end: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/end`),
};
