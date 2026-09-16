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

type Destination = Record<string, unknown> | null | undefined;

const DETAIL_ORDER: { key: string; label: string }[] = [
  { key: 'accountHolder', label: 'Account holder' },
  { key: 'upiId', label: 'UPI ID' },
  { key: 'bankName', label: 'Bank' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'branch', label: 'Branch' },
  { key: 'accountType', label: 'Account type' },
];

function destinationRows(dest: Destination): { label: string; value: string }[] {
  if (!dest || typeof dest !== 'object') return [];
  const used = new Set<string>();
  const rows: { label: string; value: string }[] = [];
  for (const { key, label } of DETAIL_ORDER) {
    const value = dest[key];
    if (value == null || String(value).trim() === '') continue;
    used.add(key);
    rows.push({ label, value: String(value) });
  }
  for (const [key, value] of Object.entries(dest)) {
    if (used.has(key) || value == null || String(value).trim() === '') continue;
    rows.push({
      label: key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' '),
      value: String(value),
    });
  }
  return rows;
}

function DestinationDetails({ dest }: { dest: Destination }) {
  const rows = destinationRows(dest);
  if (!rows.length) return <span className="text-white/40">No payout details</span>;
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[7.5rem_1fr] gap-x-2">
          <dt className="text-white/40">{row.label}</dt>
          <dd className="break-all font-medium text-white">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

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
                  <td className="p-4 align-top">
                    <p className="font-medium">{w.host?.displayName ?? w.host?.email}</p>
                    {w.host?.email ? (
                      <p className="mt-0.5 text-xs text-white/40">{w.host.email}</p>
                    ) : null}
                    {w.host?.username ? (
                      <p className="text-xs text-white/40">@{w.host.username}</p>
                    ) : null}
                  </td>
                  <td className="p-4 align-top capitalize">{String(w.method).replace(/_/g, ' ')}</td>
                  <td className="min-w-[280px] p-4 align-top">
                    <DestinationDetails dest={w.destination} />
                  </td>
                  <td className="p-4 align-top">{w.goldAmount} 🪙</td>
                  <td className="p-4 align-top">{formatMoney(w.fiatAmount, country)}</td>
                  <td className="p-4 align-top">
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
