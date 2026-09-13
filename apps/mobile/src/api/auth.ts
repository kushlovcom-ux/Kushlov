import { apiGet, apiPost } from './client';
import type { AuthPayload, Gender, PublicUser } from '@/types';

export type RegisterInput = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  accountType?: 'user' | 'host';
  country: string;
  gender: Gender;
  avatar: { uri: string; type?: string; name?: string };
};

export type LoginInput = {
  email: string;
  password: string;
};

export const authApi = {
  register: (body: RegisterInput) => {
    const form = new FormData();
    form.append('email', body.email);
    form.append('username', body.username);
    form.append('displayName', body.displayName);
    form.append('password', body.password);
    form.append('accountType', body.accountType ?? 'user');
    form.append('country', body.country);
    form.append('gender', body.gender);
    form.append('avatar', {
      uri: body.avatar.uri,
      type: body.avatar.type ?? 'image/jpeg',
      name: body.avatar.name ?? 'avatar.jpg',
    } as unknown as Blob);
    return apiPost<AuthPayload>('/auth/register', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
  },
  login: (body: LoginInput) => apiPost<AuthPayload>('/auth/login', body),
  google: (body: { idToken: string; country?: string }) =>
    apiPost<AuthPayload>('/auth/google', body),
  refresh: (refreshToken: string) =>
    apiPost<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      refreshToken,
    }),
  logout: () => apiPost<{ ok: boolean }>('/auth/logout'),
  me: () => apiGet<PublicUser>('/auth/me'),
  forgotPassword: (email: string) =>
    apiPost<{ ok: boolean }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    apiPost<{ ok: boolean }>('/auth/reset-password', { token, password }),
};
