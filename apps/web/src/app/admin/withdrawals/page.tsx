'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { WithdrawStatus } from '@kushlov/types';
import { formatMoney } from '@kushlov/utils';
import { useAuthStore } from '@/store/auth';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminWithdrawalsPage() {
  const qc = useQueryClient();
  const country = useAuthStore((s) => s.user?.country);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: () => unwrap<{ items: any[] }>(api.get('/admin/withdrawals')),
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WithdrawStatus }) =>
      api.patch(`/admin/withdrawals/${id}`, { status }),
    onSuccess: () => {
      toast.success('Withdrawal updated');
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader title="Withdrawals" subtitle="Host payout requests" />
      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/50">
              <tr>
                <th className="p-4">Host</th>
                <th className="p-4">Method</th>
                <th className="p-4">Details</th>
                <th className="p-4">Gold</th>
                <th className="p-4">Payout</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-4">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              )}
              {data?.items.map((w) => (
                <tr key={w._id} className="border-t border-white/5">
                  <td className="p-4">{w.host?.displayName ?? w.host?.email}</td>
                  <td className="p-4 capitalize">{String(w.method).replace(/_/g, ' ')}</td>
                  <td className="max-w-[200px] truncate p-4 text-xs text-white/50">
                    {w.destination?.upiId ??
                      [w.destination?.bankName, w.destination?.accountNumber?.slice(-4)]
                        .filter(Boolean)
                        .join(' · ')}
                  </td>
                  <td className="p-4">{w.goldAmount} 🪙</td>
                  <td className="p-4">{formatMoney(w.fiatAmount, country)}</td>
                  <td className="p-4">
                    <Badge variant={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'destructive' : 'warning'}>
                      {w.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      {w.status === 'requested' && (
                        <>
                          <Button size="sm" onClick={() => review.mutate({ id: w._id, status: WithdrawStatus.Approved })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => review.mutate({ id: w._id, status: WithdrawStatus.Rejected })}>
                            Reject
                          </Button>
                        </>
                      )}
                      {w.status === 'approved' && (
                        <Button size="sm" onClick={() => review.mutate({ id: w._id, status: WithdrawStatus.Paid })}>
                          Mark paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
