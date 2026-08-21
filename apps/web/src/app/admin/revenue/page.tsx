'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Role } from '@kushlov/types';
import { formatMoney } from '@kushlov/utils';
import { useAuthStore } from '@/store/auth';
import { api, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/common/user-avatar';

type PaymentUser = {
  _id?: string;
  id?: string;
  displayName?: string;
  username?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
};

type PaymentRow = {
  _id: string;
  amount: number;
  currency?: string;
  diamonds: number;
  status: string;
  createdAt: string;
  packageId?: string;
  user?: PaymentUser;
};

type PaymentsPage = {
  items: PaymentRow[];
  total: number;
};

function userIdOf(u?: PaymentUser) {
  return u?.id || u?._id || '';
}

export default function AdminRevenuePage() {
  const country = useAuthStore((s) => s.user?.country);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () =>
      unwrap<PaymentsPage>(
        api.get('/admin/payments', { params: { status: 'succeeded', limit: 100 } }),
      ),
  });

  const items = data?.items ?? [];

  const summary = useMemo(() => {
    let total = 0;
    let normal = 0;
    let host = 0;
    let normalCount = 0;
    let hostCount = 0;
    for (const p of items) {
      total += Number(p.amount) || 0;
      if (p.user?.role === Role.Host) {
        host += Number(p.amount) || 0;
        hostCount += 1;
      } else {
        normal += Number(p.amount) || 0;
        normalCount += 1;
      }
    }
    return { total, normal, host, normalCount, hostCount };
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle="Diamond purchases by normal users and hosts — who paid, and how much"
      />

      <div className="grid gap-4 px-6 pt-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-white/45">Succeeded revenue</p>
          <p className="mt-1 text-2xl font-extrabold">{formatMoney(summary.total, country)}</p>
          <p className="mt-1 text-xs text-white/40">{items.length} purchases</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-white/45">From normal users</p>
          <p className="mt-1 text-2xl font-extrabold text-sky-300">
            {formatMoney(summary.normal, country)}
          </p>
          <p className="mt-1 text-xs text-white/40">{summary.normalCount} purchases</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-white/45">From hosts</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-300">
            {formatMoney(summary.host, country)}
          </p>
          <p className="mt-1 text-xs text-white/40">{summary.hostCount} purchases</p>
        </div>
      </div>

      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/50">
              <tr>
                <th className="p-4">Who paid</th>
                <th className="p-4">Account type</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Diamonds</th>
                <th className="p-4">When</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-4">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              )}
              {items.map((p) => {
                const u = p.user;
                const id = userIdOf(u);
                const isHost = u?.role === Role.Host;
                return (
                  <tr key={p._id} className="border-t border-white/5">
                    <td className="p-4">
                      {id ? (
                        <Link
                          href={`/admin/users/${id}`}
                          className="flex items-center gap-3 hover:opacity-90"
                        >
                          <UserAvatar
                            name={u?.displayName ?? u?.email ?? 'User'}
                            src={u?.avatarUrl}
                            className="h-9 w-9"
                          />
                          <div>
                            <p className="font-medium">{u?.displayName ?? u?.email ?? 'Unknown'}</p>
                            <p className="text-xs text-white/40">
                              {u?.username ? `@${u.username}` : u?.email}
                            </p>
                          </div>
                        </Link>
                      ) : (
                        <span className="text-white/50">{u?.email ?? 'Unknown'}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant={isHost ? 'success' : 'secondary'}>
                        {isHost ? 'Host' : 'Normal user'}
                      </Badge>
                    </td>
                    <td className="p-4 font-semibold">{formatMoney(p.amount, country)}</td>
                    <td className="p-4">{p.diamonds} 💎</td>
                    <td className="p-4 text-white/40">{relativeTime(p.createdAt)}</td>
                  </tr>
                );
              })}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-white/40">
                    No succeeded payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
