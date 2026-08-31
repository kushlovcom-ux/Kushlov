import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth';
import { connectSocket } from '@/services/socket';

export class ApiError extends Error {
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    opts?: { status?: number; code?: string; errors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.code = opts?.code;
    this.errors = opts?.errors;
  }
}

type Envelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
};

let refreshPromise: Promise<string | null> | null = null;

function isAuthCredentialUrl(url = ''): boolean {
  return (
    url.includes('/auth/google') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(err: AxiosError): number {
  const raw = err.response?.headers?.['retry-after'];
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    // Header may be seconds or an HTTP date; treat small numbers as seconds.
    const sec = n > 1_000_000_000 ? Math.max(1, n - Math.floor(Date.now() / 1000)) : n;
    return Math.min(Math.max(sec, 1) * 1000, 12_000);
  }
  return 2000;
}

export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) {
    // No refresh token available — cannot renew; end the session.
    clear();
    return null;
  }
  try {
    const res = await axios.post<Envelope<{ accessToken: string; refreshToken: string }>>(
      `${env.apiUrl}/auth/refresh`,
      { refreshToken },
      { timeout: 15000 },
    );
    if (!res.data?.success || !res.data.data?.accessToken) {
      // Definitive auth rejection from server payload.
      clear();
      return null;
    }
    const nextAccess = res.data.data.accessToken;
    const nextRefresh = res.data.data.refreshToken ?? refreshToken;
    setTokens(nextAccess, nextRefresh);
    connectSocket(nextAccess);
    return nextAccess;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    // Only wipe session on definitive auth failure — not network/429/5xx.
    // Transient clears caused wallet/messages/location to vanish then reappear.
    if (status === 401 || status === 403) {
      clear();
    }
    return null;
  }
}

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _retryTransient?: boolean;
};

function getClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.apiUrl,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const token = useAuthStore.getState().accessToken;
    if (token && !isAuthCredentialUrl(url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const body = response.data as Envelope<unknown>;
      if (body && typeof body === 'object' && 'success' in body && body.success === false) {
        throw new ApiError(body.message || 'Request failed', {
          status: response.status,
          code: body.code,
          errors: body.errors,
        });
      }
      return response;
    },
    async (error: AxiosError<Envelope<unknown>>) => {
      const original = error.config as RetryConfig | undefined;
      const status = error.response?.status;
      const url = `${original?.baseURL ?? ''}${original?.url ?? ''}`;

      if (
        status === 401 &&
        original &&
        !original._retry &&
        !isAuthCredentialUrl(url)
      ) {
        original._retry = true;
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const token = await refreshPromise;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        }
      }

      const transient =
        status === 429 || status === 502 || status === 503 || status === 504 || !error.response;
      if (original && !original._retryTransient && transient && !isAuthCredentialUrl(url)) {
        original._retryTransient = true;
        await sleep(status === 429 ? retryAfterMs(error) : 1200);
        return client(original);
      }

      const data = error.response?.data;
      throw new ApiError(data?.message || error.message || 'Network error', {
        status,
        code: data?.code,
        errors: data?.errors,
      });
    },
  );

  return client;
}

export const api = getClient();

export async function unwrap<T>(promise: Promise<{ data: Envelope<T> }>): Promise<T> {
  const res = await promise;
  const body = res.data;
  if (!body?.success) {
    throw new ApiError(body?.message || 'Request failed', {
      code: body?.code,
      errors: body?.errors,
    });
  }
  return body.data as T;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig) {
  return unwrap<T>(api.get(url, config));
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return unwrap<T>(api.post(url, data, config));
}

export async function apiPatch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return unwrap<T>(api.patch(url, data, config));
}

export async function apiPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return unwrap<T>(api.put(url, data, config));
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig) {
  return unwrap<T>(api.delete(url, config));
}

export function isRetryableQueryError(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.status === 502 || err.status === 503 || err.status === 504) {
      return true;
    }
    if (!err.status) return true;
    if (err.status >= 500) return true;
    return false;
  }
  return true;
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.code === 'RATE_LIMITED') {
      return "You've made several requests in a short time. Please wait a moment and try again.";
    }
    if (!err.status && /network/i.test(err.message)) {
      return 'Connection lost. Check your internet and try again.';
    }
    return err.message;
  }
  if (err instanceof Error) {
    if (/network/i.test(err.message)) {
      return 'Connection lost. Check your internet and try again.';
    }
    return err.message;
  }
  return fallback;
}

/** Alias used by screens/lib for a short error string */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  return getErrorMessage(err, fallback);
}
