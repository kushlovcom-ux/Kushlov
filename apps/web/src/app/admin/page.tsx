'use client';

import Link from 'next/link';
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
  CircleDot,
  User,
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
  totalNormalUsers: number;
  totalHosts: number;
  approvedHosts: number;
  onlineNormalUsers: number;
  onlineHostUsers: number;
  liveNow: number;
  pendingVerifications: number;
  openReports: number;
  pendingWithdrawals: number;
  revenue: number;
  newUsers7d: number;
}

type DashCard = {
  label: string;
  value: string | number;
  icon: typeof Users;
  color: string;
  href?: string;
  badge?: number;
};

export default function AdminDashboard() {
  const formatPrice = useFormatMoney();
  const badges = useAdminBadges();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => unwrap<Analytics>(api.get('/admin/analytics')),
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const cards: DashCard[] = [
    {
      label: 'Total users',
      value: formatCompact(data?.totalUsers ?? 0),
      icon: Users,
      color: 'text-brand-blue',
      href: '/admin/users',
    },
    {
      label: 'Normal users',
      value: formatCompact(data?.totalNormalUsers ?? 0),
      icon: User,
      color: 'text-sky-400',
      href: '/admin/users?role=user',
    },
    {
      label: 'Host users',
      value: formatCompact(data?.totalHosts ?? 0),
      icon: Crown,
      color: 'text-amber-400',
      href: '/admin/users?role=host',
    },
    {
      label: 'Normal users online',
      value: formatCompact(data?.onlineNormalUsers ?? 0),
      icon: CircleDot,
      color: 'text-blue-400',
      href: '/admin/online?role=user',
    },
    {
      label: 'Hosts online',
      value: formatCompact(data?.onlineHostUsers ?? 0),
      icon: CircleDot,
      color: 'text-emerald-400',
      href: '/admin/online?role=host',
    },
    {
      label: 'Revenue',
      value: formatPrice(data?.revenue ?? 0),
      icon: IndianRupee,
      color: 'text-emerald-400',
      href: '/admin/revenue',
    },
    {
      label: 'Approved hosts',
      value: formatCompact(data?.approvedHosts ?? 0),
      icon: ShieldCheck,
      color: 'text-emerald-400',
      href: '/admin/hosts',
    },
    {
      label: 'Live now',
      value: formatCompact(data?.liveNow ?? 0),
      icon: Radio,
      color: 'text-red-400',
      href: '/admin/live',
    },
    {
      label: 'New users (7d)',
      value: formatCompact(data?.newUsers7d ?? 0),
      icon: UserPlus,
      color: 'text-brand-pink',
      href: '/admin/users',
    },
    {
      label: 'Pending verifications',
      value: data?.pendingVerifications ?? 0,
      icon: ShieldCheck,
      color: 'text-amber-400',
      badge: badges.verifications,
      href: '/admin/verifications',
    },
    {
      label: 'Open reports',
      value: data?.openReports ?? 0,
      icon: Flag,
      color: 'text-red-400',
      badge: badges.reports,
      href: '/admin/reports',
    },
    {
      label: 'Pending withdrawals',
      value: data?.pendingWithdrawals ?? 0,
      icon: Banknote,
      color: 'text-brand-purple',
      badge: badges.withdrawals,
      href: '/admin/withdrawals',
    },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview — tap a card to open that section" />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : cards.map((c) => {
              const pending = c.badge ?? 0;
              const inner = (
                <>
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
                </>
              );
              const className = cn(
                'glass relative rounded-2xl p-6',
                pending > 0 && 'ring-1 ring-brand-pink/40',
                c.href && 'transition hover:-translate-y-0.5 hover:border-brand-pink/40 hover:bg-white/[0.04]',
              );
              if (c.href) {
                return (
                  <Link key={c.label} href={c.href} className={className}>
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={c.label} className={className}>
                  {inner}
                </div>
              );
            })}
      </div>
    </div>
  );
}
