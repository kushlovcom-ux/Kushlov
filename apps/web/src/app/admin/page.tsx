'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Radio,
  ShieldCheck,
  Flag,
  Banknote,
  Crown,
  UserPlus,
  IndianRupee,
} from 'lucide-react';
import { formatCompact } from '@kushlov/utils';
import { useFormatMoney } from '@/hooks/use-format-money';
import { useAdminBadges } from '@/hooks/use-admin-badges';
import { api, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { NavBadge } from '@/components/app/nav-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Analytics {
  totalUsers: number;
  totalHosts: number;
  approvedHosts: number;
  liveNow: number;
  pendingVerifications: number;
  openReports: number;
  pendingWithdrawals: number;
  revenue: number;
  newUsers7d: number;
}

export default function AdminDashboard() {
  const formatPrice = useFormatMoney();
  const badges = useAdminBadges();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => unwrap<Analytics>(api.get('/admin/analytics')),
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const cards = [
    { label: 'Total Users', value: formatCompact(data?.totalUsers ?? 0), icon: Users, color: 'text-brand-blue' },
    { label: 'Hosts', value: formatCompact(data?.totalHosts ?? 0), icon: Crown, color: 'text-amber-400' },
    { label: 'Approved Hosts', value: formatCompact(data?.approvedHosts ?? 0), icon: ShieldCheck, color: 'text-emerald-400' },
    { label: 'Live Now', value: formatCompact(data?.liveNow ?? 0), icon: Radio, color: 'text-red-400' },
    { label: 'Revenue', value: formatPrice(data?.revenue ?? 0), icon: IndianRupee, color: 'text-emerald-400' },
    { label: 'New Users (7d)', value: formatCompact(data?.newUsers7d ?? 0), icon: UserPlus, color: 'text-brand-pink' },
    { label: 'Pending Verifications', value: data?.pendingVerifications ?? 0, icon: ShieldCheck, color: 'text-amber-400', badge: badges.verifications, href: '/admin/verifications' },
    { label: 'Open Reports', value: data?.openReports ?? 0, icon: Flag, color: 'text-red-400', badge: badges.reports, href: '/admin/reports' },
    { label: 'Pending Withdrawals', value: data?.pendingWithdrawals ?? 0, icon: Banknote, color: 'text-brand-purple', badge: badges.withdrawals, href: '/admin/withdrawals' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : cards.map((c) => {
              const pending = c.badge ?? 0;
              return (
              <div
                key={c.label}
                className={cn(
                  'glass relative rounded-2xl p-6',
                  pending > 0 && 'ring-1 ring-brand-pink/40',
                )}
              >
                {pending > 0 && (
                  <span className="absolute right-4 top-4">
                    <NavBadge count={pending} />
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">{c.label}</span>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <p className="mt-3 text-3xl font-extrabold">{c.value}</p>
              </div>
            );
            })}
      </div>
    </div>
  );
}
