'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/components/socket-provider';

export interface NavBadges {
  notifications: number;
  messages: number;
}

export function useNavBadges() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connected } = useSocket();

  const { data } = useQuery({
    queryKey: ['nav-badges'],
    queryFn: () => unwrap<NavBadges>(api.get('/users/me/badges')),
    enabled: Boolean(accessToken),
    staleTime: 20_000,
    // Sockets already invalidate this on new messages. Poll slowly as a fallback.
    refetchInterval: connected ? 60_000 : 20_000,
    refetchIntervalInBackground: false,
  });

  return data ?? { notifications: 0, messages: 0 };
}

export function navBadgeForHref(href: string, badges: NavBadges): number {
  if (href === '/messages') return badges.messages;
  if (href === '/notifications') return badges.notifications;
  return 0;
}
