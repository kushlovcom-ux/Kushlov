import { api, apiGet, apiPost } from './client';
import type { LiveRoom, Paginated } from '@/types';

export const liveApi = {
  list: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<LiveRoom>>('/live', { params }),
  get: (id: string) => apiGet<LiveRoom>(`/live/${id}`),
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
    const data = res.data.data as { live?: LiveRoom } & LiveRoom;
    return (data.live ?? data) as LiveRoom;
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
  coliveAccept: (id: string) =>
    apiPost<{
      token: string;
      livekitUrl?: string;
      roomName?: string;
      live?: LiveRoom;
      role?: string;
    }>(`/live/${id}/colive/accept`),
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
