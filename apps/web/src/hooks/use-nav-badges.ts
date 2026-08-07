'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export interface NavBadges {
  notifications: number;
  messages: number;
}

export function useNavBadges() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data } = useQuery({
    queryKey: ['nav-badges'],
    queryFn: () => unwrap<NavBadges>(api.get('/users/me/badges')),
    enabled: Boolean(accessToken),
    refetchInterval: 8_000,
  });

  return data ?? { notifications: 0, messages: 0 };
}

export function navBadgeForHref(href: string, badges: NavBadges): number {
  if (href === '/messages') return badges.messages;
  if (href === '/notifications') return badges.notifications;
  return 0;
}
