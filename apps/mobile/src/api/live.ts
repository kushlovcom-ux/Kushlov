import { api, apiGet, apiPost } from './client';
import { normalizeLiveRoom } from '@/utils/normalizeLive';
import type { LiveRoom, Paginated } from '@/types';

export const liveApi = {
  list: async (params?: { page?: number; limit?: number }) => {
    const res = await apiGet<Paginated<unknown>>('/live', { params });
    return {
      ...res,
      items: (res.items ?? []).map((i) => normalizeLiveRoom(i)).filter((r) => Boolean(r.id)),
    };
  },
  get: async (id: string) => normalizeLiveRoom(await apiGet<unknown>(`/live/${id}`)),
  start: async (payload: { title: string; thumbnailUri?: string }) => {
    const form = new FormData();
    form.append('title', payload.title);
    if (payload.thumbnailUri) {
      form.append('thumbnail', {
        uri: payload.thumbnailUri,
        type: 'image/jpeg',
        name: 'thumbnail.jpg',
      } as unknown as Blob);
    }
    const res = await api.post('/live/start', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const data = res.data.data as { live?: unknown } & Record<string, unknown>;
    return normalizeLiveRoom(data.live ?? data);
  },
  hostToken: (id: string) =>
    apiGet<{ token: string; livekitUrl?: string; roomName?: string; viewerCount?: number }>(
      `/live/${id}/host-token`,
    ),
  previewToken: (id: string) =>
    apiGet<{ token: string; livekitUrl?: string; roomName?: string }>(`/live/${id}/preview-token`),
  end: (id: string) => apiPost<LiveRoom>(`/live/${id}/end`),
  join: (id: string) =>
    apiPost<{ token?: string; livekitUrl?: string; roomName?: string; viewerCount?: number }>(
      `/live/${id}/join`,
    ),
  leave: (id: string) => apiPost<{ ok: boolean; viewerCount?: number }>(`/live/${id}/leave`),
  chat: (id: string, message: string) =>
    apiPost<{
      _id?: string;
      id?: string;
      message: string;
      user?: { displayName?: string; avatarUrl?: string };
    }>(`/live/${id}/chat`, { message }),
  listChat: (id: string, params?: { after?: string; limit?: number }) =>
    apiGet<{
      messages: Array<{
        _id?: string;
        id?: string;
        message: string;
        user?: { displayName?: string; avatarUrl?: string };
      }>;
    }>(`/live/${id}/chat`, { params }),
  like: (id: string) => apiPost<{ likeCount: number }>(`/live/${id}/like`),
  gift: (id: string, giftId: string) =>
    apiPost<{ ok: boolean }>(`/live/${id}/gift`, { giftId }),
  ban: (id: string, userId: string) =>
    apiPost<{ ok: boolean }>(`/live/${id}/ban/${userId}`),
  addModerator: (id: string, userId: string) =>
    apiPost<{ ok: boolean }>(`/live/${id}/moderator/${userId}`),
  viewers: (id: string) =>
    apiGet<{
      viewerCount: number;
      viewers: Array<{
        id: string;
        displayName?: string;
        username?: string;
        avatarUrl?: string;
        role?: string;
        joinedAt?: string;
      }>;
    }>(`/live/${id}/viewers`),
  coliveInvite: (id: string, hostId: string) =>
    apiPost<{ invited: boolean }>(`/live/${id}/colive/invite`, { hostId }),
  coliveIncoming: () =>
    apiGet<{
      items: Array<{
        liveId: string;
        title?: string;
        roomName?: string;
        from?: { id?: string; displayName?: string; avatarUrl?: string };
      }>;
    }>('/live/colive/incoming'),
  coliveAccept: async (id: string) => {
    const raw = await apiPost<{
      token: string;
      livekitUrl?: string;
      roomName?: string;
      live?: unknown;
      role?: string;
    }>(`/live/${id}/colive/accept`);
    return {
      ...raw,
      live: raw.live ? normalizeLiveRoom(raw.live) : undefined,
    };
  },
  coliveToken: (id: string) =>
    apiGet<{
      token: string;
      livekitUrl?: string;
      roomName?: string;
      viewerCount?: number;
      role?: string;
    }>(`/live/${id}/colive/token`),
  coliveReject: (id: string) => apiPost<{ rejected: boolean }>(`/live/${id}/colive/reject`),
  coliveLeave: (id: string) => apiPost<{ ok: boolean }>(`/live/${id}/colive/leave`),
};
