import { api, apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { MediaAsset, NavBadges, Paginated, PublicUser, UserLocation, UserProfile } from '@/types';

export type SearchUsersParams = {
  q?: string;
  page?: number;
  limit?: number;
  gender?: string;
  online?: boolean;
  role?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

export const usersApi = {
  search: (params?: SearchUsersParams) =>
    apiGet<Paginated<PublicUser>>('/users', { params }),
  /** Name search across connectable users (not limited to ~10 km browse radius). */
  searchContacts: async (q: string) => {
    const res = await apiGet<{ items: PublicUser[] }>('/users/me/search-contacts', {
      params: { q },
    });
    return {
      items: (res.items ?? []).map((u) => {
        const raw = u as PublicUser & { _id?: string };
        return {
          ...raw,
          id: raw.id || raw._id || '',
        };
      }),
    };
  },
  topRatedHosts: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PublicUser>>('/users/hosts/top-rated', { params }),
  hosts: (params?: SearchUsersParams) =>
    apiGet<Paginated<PublicUser>>('/users/hosts', { params }),
  getById: async (id: string) => {
    const data = await apiGet<{
      user: PublicUser;
      profile?: UserProfile;
      distanceKm?: number | null;
    }>(`/users/${id}`);
    const user = data.user;
    return {
      ...user,
      bio: data.profile?.bio ?? user.bio,
      dob: data.profile?.dob ?? user.dob,
      gender: data.profile?.gender ?? user.gender,
      gallery: data.profile?.gallery ?? user.gallery ?? [],
      languages: data.profile?.languages ?? user.languages,
      interestedIn: data.profile?.interestedIn ?? user.interestedIn,
      distanceKm: data.distanceKm ?? user.distanceKm,
      coverUrl: user.coverUrl,
      profile: data.profile,
    } as PublicUser & { profile?: UserProfile };
  },
  updateMe: (body: Partial<Pick<PublicUser, 'displayName' | 'country' | 'bio'>>) =>
    apiPatch<PublicUser>('/users/me', body),
  badges: async () => {
    const raw = await apiGet<{ notifications?: number; messages?: number }>('/users/me/badges');
    return {
      notifications: raw.notifications ?? 0,
      unreadNotifications: raw.notifications ?? 0,
      messages: raw.messages ?? 0,
      unreadMessages: raw.messages ?? 0,
    };
  },
  getProfile: () => apiGet<UserProfile>('/users/me/profile'),
  updateProfile: (body: Partial<UserProfile>) =>
    apiPatch<UserProfile>('/users/me/profile', body),
  getLocation: () => apiGet<UserLocation | null>('/users/me/location'),
  updateLocation: (body: { lat: number; lng: number; city?: string; country?: string }) =>
    apiPost<UserLocation>('/users/me/location', body),
  pingPresence: () => apiPost<{ ok: boolean }>('/users/me/presence'),
  registerPushToken: (
    token: string,
    extra?: { platform?: 'ios' | 'android' | 'web'; deviceId?: string },
  ) => apiPost<{ ok: boolean }>('/users/me/push-token', { token, ...extra }),
  clearPushToken: (token?: string) =>
    apiPost<{ ok: boolean }>('/users/me/push-token/clear', token ? { token } : {}),
  uploadAvatar: async (uri: string, mimeType = 'image/jpeg', name = 'avatar.jpg') => {
    const form = new FormData();
    form.append('file', { uri, type: mimeType, name } as unknown as Blob);
    const res = await api.post('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as PublicUser;
  },
  uploadCover: async (uri: string, mimeType = 'image/jpeg', name = 'cover.jpg') => {
    const form = new FormData();
    form.append('file', { uri, type: mimeType, name } as unknown as Blob);
    const res = await api.post('/users/me/cover', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as PublicUser;
  },
  addGallery: async (uri: string, mimeType = 'image/jpeg', name = 'gallery.jpg') => {
    const form = new FormData();
    form.append('file', { uri, type: mimeType, name } as unknown as Blob);
    const res = await api.post('/users/me/gallery', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as { gallery: MediaAsset[] };
  },
  removeGallery: (mediaId: string) =>
    apiDelete<{ gallery: MediaAsset[] }>(`/users/me/gallery/${mediaId}`),
};
