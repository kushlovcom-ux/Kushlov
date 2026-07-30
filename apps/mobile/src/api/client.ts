import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth';

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

export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) {
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
      clear();
      return null;
    }
    const nextAccess = res.data.data.accessToken;
    const nextRefresh = res.data.data.refreshToken ?? refreshToken;
    setTokens(nextAccess, nextRefresh);
    return nextAccess;
  } catch {
    clear();
    return null;
  }
}

function getClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.apiUrl,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
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
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const status = error.response?.status;

      if (status === 401 && original && !original._retry && !original.url?.includes('/auth/refresh')) {
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

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.code === 'RATE_LIMITED') {
      return "You've made several requests in a short time. Please wait a moment and try again.";
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/** Alias used by screens/lib for a short error string */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  return getErrorMessage(err, fallback);
}
