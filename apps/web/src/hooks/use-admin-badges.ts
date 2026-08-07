'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export interface AdminBadges {
  verifications: number;
  reports: number;
  withdrawals: number;
  inquiries: number;
  total: number;
}

export function useAdminBadges() {
  const user = useAuthStore((s) => s.user);

  const { data } = useQuery({
    queryKey: ['admin-badges'],
    queryFn: () => unwrap<AdminBadges>(api.get('/admin/badges')),
    enabled: user?.role === 'admin',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return data ?? { verifications: 0, reports: 0, withdrawals: 0, inquiries: 0, total: 0 };
}

export function adminBadgeForHref(href: string, badges: AdminBadges): number {
  if (href === '/admin/verifications') return badges.verifications;
  if (href === '/admin/reports') return badges.reports;
  if (href === '/admin/withdrawals') return badges.withdrawals;
  if (href === '/admin/inquiries') return badges.inquiries;
  if (href === '/admin') return badges.total;
  return 0;
}
