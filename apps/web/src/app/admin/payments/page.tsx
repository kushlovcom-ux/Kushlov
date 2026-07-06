'use client';

import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@kushlov/utils';
import { api, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => unwrap<{ items: any[] }>(api.get('/admin/payments')),
  });

  return (
    <div>
      <PageHeader title="Payments" subtitle="All diamond purchases" />
      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/50">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Diamonds</th>
                <th className="p-4">Status</th>
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
              {data?.items.map((p) => (
                <tr key={p._id} className="border-t border-white/5">
                  <td className="p-4">{p.user?.displayName ?? p.user?.email}</td>
                  <td className="p-4">{formatCurrency(p.amount, p.currency)}</td>
                  <td className="p-4">{p.diamonds} 💎</td>
                  <td className="p-4">
                    <Badge variant={p.status === 'succeeded' ? 'success' : p.status === 'failed' ? 'destructive' : 'warning'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-white/40">{relativeTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
