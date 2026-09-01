import { apiGet, apiPost } from './client';
import { normalizeCallSession } from '@/utils/normalizeCall';
import type { CallSession, CallType, Paginated } from '@/types';

export const callsApi = {
  initiate: async (body: {
    type: CallType;
    calleeId?: string;
    participantIds?: string[];
    /** Park this Ongoing call and start a consult to callee. */
    fromCallId?: string;
  }) => {
    const raw = await apiPost<unknown>('/calls/initiate', body);
    return normalizeCallSession(raw);
  },
  invite: (type: CallType | string, id: string, userId: string) =>
    apiPost<{ ok?: boolean }>(`/calls/${type}/${id}/invite`, { userId }),
  hold: (type: CallType | string, id: string) =>
    apiPost<{ callId: string; held: boolean }>(`/calls/${type}/${id}/hold`),
  unhold: async (type: CallType | string, id: string) => {
    const raw = await apiPost<unknown>(`/calls/${type}/${id}/unhold`);
    return normalizeCallSession(raw);
  },
  merge: async (type: CallType | string, id: string, heldCallId: string) => {
    const raw = await apiPost<unknown>(`/calls/${type}/${id}/merge`, { heldCallId });
    return normalizeCallSession(raw);
  },
  incoming: async () => {
    const res = await apiGet<{ items: unknown[] }>('/calls/incoming');
    return { items: (res.items ?? []).map((i) => normalizeCallSession(i)) };
  },
  history: async (params?: { page?: number; limit?: number }) => {
    const res = await apiGet<Paginated<unknown>>('/calls/history', { params });
    return {
      ...res,
      items: (res.items ?? []).map((i) => normalizeCallSession(i)),
    };
  },
  get: async (type: CallType | string, id: string) =>
    normalizeCallSession(await apiGet<unknown>(`/calls/${type}/${id}`)),
  /** Ongoing calls for the current user (parked → merge HTTP fallback). */
  active: async () => {
    const res = await apiGet<{ items?: unknown[] }>('/calls/active');
    return { items: (res.items ?? []).map((i) => normalizeCallSession(i)) };
  },
  accept: async (type: CallType | string, id: string) =>
    normalizeCallSession(await apiPost<unknown>(`/calls/${type}/${id}/accept`)),
  acceptInterrupt: async (type: CallType | string, id: string) =>
    normalizeCallSession(await apiPost<unknown>(`/calls/${type}/${id}/accept-interrupt`)),
  reject: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/reject`),
  removeParticipant: (type: CallType | string, id: string, userId: string) =>
    apiPost<{ call?: CallSession; ended?: boolean }>(
      `/calls/${type}/${id}/participants/${userId}/remove`,
    ),
  end: (type: CallType | string, id: string) =>
    apiPost<CallSession>(`/calls/${type}/${id}/end`),
};
