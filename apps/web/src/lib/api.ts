import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { API_BASE } from './env';
import { useAuthStore } from '@/store/auth';

/** Shared axios instance. Sends cookies (refresh token) and bearer access token. */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Transparent access-token refresh on 401 (single-flight) ---
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const token = data?.data?.accessToken as string | undefined;
    if (token) {
      useAuthStore.getState().setAccessToken(token);
      return token;
    }
  } catch {
    useAuthStore.getState().clear();
  }
  return null;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Normalize an axios error into a user-facing message. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** Unwrap the standard { success, data } envelope. */
export async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}
