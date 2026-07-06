'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Radio,
  ShieldCheck,
  Flag,
  Banknote,
  DollarSign,
  UserPlus,
  Crown,
} from 'lucide-react';
import { formatCompact, formatCurrency } from '@kushlov/utils';
import { api, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Skeleton } from '@/components/ui/skeleton';

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
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => unwrap<Analytics>(api.get('/admin/analytics')),
  });

  const cards = [
    { label: 'Total Users', value: formatCompact(data?.totalUsers ?? 0), icon: Users, color: 'text-brand-blue' },
    { label: 'Hosts', value: formatCompact(data?.totalHosts ?? 0), icon: Crown, color: 'text-amber-400' },
    { label: 'Approved Hosts', value: formatCompact(data?.approvedHosts ?? 0), icon: ShieldCheck, color: 'text-emerald-400' },
    { label: 'Live Now', value: formatCompact(data?.liveNow ?? 0), icon: Radio, color: 'text-red-400' },
    { label: 'Revenue', value: formatCurrency(data?.revenue ?? 0), icon: DollarSign, color: 'text-emerald-400' },
    { label: 'New Users (7d)', value: formatCompact(data?.newUsers7d ?? 0), icon: UserPlus, color: 'text-brand-pink' },
    { label: 'Pending Verifications', value: data?.pendingVerifications ?? 0, icon: ShieldCheck, color: 'text-amber-400' },
    { label: 'Open Reports', value: data?.openReports ?? 0, icon: Flag, color: 'text-red-400' },
    { label: 'Pending Withdrawals', value: data?.pendingWithdrawals ?? 0, icon: Banknote, color: 'text-brand-purple' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : cards.map((c) => (
              <div key={c.label} className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">{c.label}</span>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <p className="mt-3 text-3xl font-extrabold">{c.value}</p>
              </div>
            ))}
      </div>
    </div>
  );
}
