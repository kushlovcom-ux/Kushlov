import { apiDelete, apiGet, apiPost } from './client';

export type RegisteredDevice = {
  deviceId: string;
  platform: 'android' | 'ios';
  appVersion?: string;
  osVersion?: string;
  lastUsedAt?: string;
  createdAt?: string;
};

export const devicesApi = {
  register: (body: {
    pushToken: string;
    platform: 'android' | 'ios';
    deviceId: string;
    appVersion?: string;
    osVersion?: string;
  }) => apiPost<{ id: string; deviceId: string; platform: string; isActive: boolean }>(
    '/devices/register',
    body,
  ),
  list: () => apiGet<{ items: RegisteredDevice[] }>('/devices'),
  unregister: (deviceId: string, pushToken?: string) => {
    const q = pushToken ? `?pushToken=${encodeURIComponent(pushToken)}` : '';
    return apiDelete<{ ok: boolean }>(`/devices/${encodeURIComponent(deviceId)}${q}`);
  },
};
