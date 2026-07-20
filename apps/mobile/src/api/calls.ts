import { apiGet, apiPost } from './client';
import type { CallSession, CallType, Paginated } from '@/types';

export const callsApi = {
  initiate: (body: { type: CallType; calleeId: string }) =>
    apiPost<CallSession>('/calls/initiate', body),
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
