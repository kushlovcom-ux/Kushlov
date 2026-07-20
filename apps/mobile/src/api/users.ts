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
  topRatedHosts: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<PublicUser>>('/users/hosts/top-rated', { params }),
  hosts: (params?: SearchUsersParams) =>
    apiGet<Paginated<PublicUser>>('/users/hosts', { params }),
  getById: (id: string) => apiGet<PublicUser & { profile?: UserProfile }>(`/users/${id}`),
  updateMe: (body: Partial<Pick<PublicUser, 'displayName' | 'country' | 'bio'>>) =>
    apiPatch<PublicUser>('/users/me', body),
  badges: () => apiGet<NavBadges>('/users/me/badges'),
  getProfile: () => apiGet<UserProfile>('/users/me/profile'),
  updateProfile: (body: Partial<UserProfile>) =>
    apiPatch<UserProfile>('/users/me/profile', body),
  getLocation: () => apiGet<UserLocation | null>('/users/me/location'),
  updateLocation: (body: { lat: number; lng: number; city?: string; country?: string }) =>
    apiPost<UserLocation>('/users/me/location', body),
  pingPresence: () => apiPost<{ ok: boolean }>('/users/me/presence'),
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
