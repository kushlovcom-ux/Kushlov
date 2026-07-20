import { apiGet } from './client';
import type { PlatformSettings, PlatformStats, PublicUser } from '@/types';

export const settingsApi = {
  get: () => apiGet<PlatformSettings>('/settings'),
  stats: () => apiGet<PlatformStats>('/settings/stats'),
  popularHosts: () => apiGet<{ items: PublicUser[] }>('/settings/popular-hosts'),
};
