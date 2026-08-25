import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { API_BASE } from './env';
import { useAuthStore } from '@/store/auth';

const FRIENDLY_429 =
  "You've made several requests in a short time. Please wait a moment and try again.";

/** Shared axios instance. Sends cookies (refresh token) and bearer access token. */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

function isAuthCredentialUrl(url: string): boolean {
  return (
    url.includes('/auth/google') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

api.interceptors.request.use((config) => {
  const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
  const token = useAuthStore.getState().accessToken;
  // Login/register/google send their own credentials — never a stale app JWT.
  if (token && !isAuthCredentialUrl(url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary — forcing Content-Type breaks uploads.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers === 'object') {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
      delete (config.headers as Record<string, unknown>)['content-type'];
    }
  }
  return config;
});

// --- Transparent access-token refresh on 401 (single-flight) ---
let refreshing: Promise<string | null> | null = null;

function isDefinitiveAuthFailure(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  // Only treat 401/403 from the refresh endpoint as "session is dead".
  // Network errors, 429, and 5xx must NOT wipe the session — that caused
  // wallet/messages/location to vanish until the cookie restored auth.
  return status === 401 || status === 403;
}

export async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = useAuthStore.getState().refreshToken;
  try {
    // Use bare axios (not `api`) so a 401 on refresh never re-enters this interceptor.
    const { data } = await axios.post(
      `${API_BASE}/auth/refresh`,
      storedRefresh ? { refreshToken: storedRefresh } : {},
      { withCredentials: true },
    );
    const accessToken = data?.data?.accessToken as string | undefined;
    const refreshToken = data?.data?.refreshToken as string | undefined;
    if (accessToken) {
      const store = useAuthStore.getState();
      store.setAccessToken(accessToken);
      if (refreshToken) store.setRefreshToken(refreshToken);
      return accessToken;
    }
    // Unexpected empty payload — keep local session; next call can retry.
    return null;
  } catch (err) {
    if (isDefinitiveAuthFailure(err)) {
      useAuthStore.getState().clear();
    }
    return null;
  }
}

async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

function readRetryAfterSec(error: AxiosError): number | undefined {
  const fromBody = (error.response?.data as { retryAfterSec?: number } | undefined)?.retryAfterSec;
  if (typeof fromBody === 'number' && fromBody > 0) return Math.ceil(fromBody);
  const header = error.response?.headers?.['retry-after'];
  if (header != null) {
    const n = Number(header);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  return undefined;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url ?? '';

    // Never try to refresh credential-exchange endpoints (login/google) or refresh itself.
    if (status === 401 && original && !original._retry && !isAuthCredentialUrl(url)) {
      original._retry = true;
      const token = await refreshAccessTokenSingleFlight();
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
    if (err.response?.status === 429) {
      const wait = readRetryAfterSec(err);
      if (wait && wait > 0) {
        const mins = Math.floor(wait / 60);
        const secs = wait % 60;
        const waitLabel =
          mins > 0 ? `${mins}m ${secs}s` : `${secs} second${secs === 1 ? '' : 's'}`;
        return `${FRIENDLY_429} (≈ ${waitLabel})`;
      }
      return FRIENDLY_429;
    }
    return (err.response?.data as { message?: string })?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** True when the error is an HTTP 429 (for React Query retry policies). */
export function isRateLimited(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

/** Unwrap the standard { success, data } envelope. */
export async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}
