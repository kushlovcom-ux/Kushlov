'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gem, Coins, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatCompact, formatCurrency } from '@kushlov/utils';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DiamondPackage {
  id: string;
  label: string;
  diamonds: number;
  bonus: number;
  price: number;
  currency: string;
}
interface WalletData {
  diamonds: number;
  gold: number;
  totalDiamondsPurchased: number;
  totalGoldEarned: number;
}
interface Txn {
  _id: string;
  direction: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export default function WalletPage() {
  const qc = useQueryClient();

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => unwrap<WalletData>(api.get('/wallet')),
  });
  const packages = useQuery({
    queryKey: ['packages'],
    queryFn: () => unwrap<DiamondPackage[]>(api.get('/payments/packages')),
  });
  const diamondTxns = useQuery({
    queryKey: ['diamondTxns'],
    queryFn: () => unwrap<{ items: Txn[] }>(api.get('/wallet/diamonds/transactions')),
  });

  const buy = useMutation({
    mutationFn: async (packageId: string) => {
      const { data } = await api.post('/payments/purchase', { packageId });
      // Mock provider settles immediately on verify.
      await api.post(`/payments/${data.data.paymentId}/verify`);
    },
    onSuccess: () => {
      toast.success('Diamonds added to your wallet 💎');
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['diamondTxns'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Manage diamonds, gold and transactions" />
      <div className="space-y-8 p-6">
        {/* Balances */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 text-brand-blue">
              <Gem className="h-6 w-6" />
              <span className="text-sm text-white/60">Diamonds</span>
            </div>
            {wallet.isLoading ? (
              <Skeleton className="mt-3 h-9 w-24" />
            ) : (
              <p className="mt-2 text-4xl font-extrabold">{formatCompact(wallet.data?.diamonds ?? 0)}</p>
            )}
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 text-amber-400">
              <Coins className="h-6 w-6" />
              <span className="text-sm text-white/60">Gold (host earnings)</span>
            </div>
            {wallet.isLoading ? (
              <Skeleton className="mt-3 h-9 w-24" />
            ) : (
              <p className="mt-2 text-4xl font-extrabold">{formatCompact(wallet.data?.gold ?? 0)}</p>
            )}
          </div>
        </div>

        <Tabs defaultValue="buy">
          <TabsList>
            <TabsTrigger value="buy">Buy diamonds</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {packages.data?.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col rounded-2xl border border-white/10 bg-card p-5 text-center"
                >
                  <Gem className="mx-auto h-8 w-8 text-brand-blue" />
                  <p className="mt-3 text-2xl font-bold">
                    {formatCompact(p.diamonds + (p.bonus ?? 0))}
                  </p>
                  {p.bonus > 0 && (
                    <p className="text-xs text-emerald-400">+{p.bonus} bonus</p>
                  )}
                  <p className="mt-1 text-sm text-white/50">{p.label}</p>
                  <Button
                    className="mt-4"
                    loading={buy.isPending && buy.variables === p.id}
                    onClick={() => buy.mutate(p.id)}
                  >
                    {formatCurrency(p.price, p.currency)}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="space-y-2">
              {diamondTxns.data?.items.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    {t.direction === 'credit' ? (
                      <TrendingUp className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{t.reason.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-white/40">{relativeTime(t.createdAt)}</p>
                    </div>
                  </div>
                  <p className={t.direction === 'credit' ? 'text-emerald-400' : 'text-red-400'}>
                    {t.direction === 'credit' ? '+' : '-'}
                    {t.amount} 💎
                  </p>
                </div>
              ))}
              {diamondTxns.data?.items.length === 0 && (
                <p className="py-12 text-center text-white/40">No transactions yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
