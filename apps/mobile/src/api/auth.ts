import { apiGet, apiPost } from './client';
import type { AuthPayload, PublicUser } from '@/types';

export type RegisterInput = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  accountType?: 'user' | 'host';
  country: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export const authApi = {
  register: (body: RegisterInput) => apiPost<AuthPayload>('/auth/register', body),
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
