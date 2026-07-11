'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gem, Coins, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { formatCompact, formatCurrency } from '@kushlov/utils';
import { useFormatMoney } from '@/hooks/use-format-money';
import { useAuthStore } from '@/store/auth';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface DiamondPackage {
  id: string;
  label: string;
  diamonds: number;
  bonus: number;
  price: number;
  currency: string;
  priceUsd?: number;
  priceInr?: number;
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
interface WithdrawSettings {
  minGold: number;
  currency: string;
}
interface DiamondConversions {
  hostVideo?: { label: string };
  hostAudio?: { label: string };
  hostMessages?: { label: string };
  userVideo?: { label: string };
  userAudio?: { label: string };
  userMessages?: { label: string };
  hostHostVideo?: { label: string };
  hostHostAudio?: { label: string };
  hostHostMessages?: { label: string };
  video?: { label: string };
  audio?: { label: string };
  messages?: { label: string };
}
interface WithdrawReq {
  _id: string;
  goldAmount: number;
  fiatAmount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
}

const WITHDRAW_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'upi', label: 'UPI' },
  { id: 'net_banking', label: 'Net Banking' },
] as const;

type WithdrawMethod = (typeof WITHDRAW_METHODS)[number]['id'];

export default function WalletPage() {
  const qc = useQueryClient();
  const formatPrice = useFormatMoney();
  const user = useAuthStore((s) => s.user);
  const isHost = user?.role === 'host';

  const [method, setMethod] = useState<WithdrawMethod>('bank_transfer');
  const [goldAmount, setGoldAmount] = useState('');
  const [dest, setDest] = useState({
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    upiId: '',
  });

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
  const goldTxns = useQuery({
    queryKey: ['goldTxns'],
    queryFn: () => unwrap<{ items: Txn[] }>(api.get('/wallet/gold/transactions')),
    enabled: isHost,
  });
  const withdrawals = useQuery({
    queryKey: ['my-withdrawals'],
    queryFn: () => unwrap<{ items: WithdrawReq[] }>(api.get('/wallet/withdrawals')),
    enabled: isHost,
  });
  const publicSettings = useQuery({
    queryKey: ['public-settings'],
    queryFn: () =>
      unwrap<{ withdraw: WithdrawSettings; diamondConversions?: DiamondConversions }>(
        api.get('/settings'),
      ),
  });

  const buy = useMutation({
    mutationFn: async (packageId: string) => {
      const { data } = await api.post('/payments/purchase', { packageId });
      await api.post(`/payments/${data.data.paymentId}/verify`);
    },
    onSuccess: () => {
      toast.success('Diamonds added to your wallet 💎');
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['diamondTxns'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const withdraw = useMutation({
    mutationFn: () => {
      const amount = parseInt(goldAmount, 10);
      const destination =
        method === 'upi'
          ? { accountHolder: dest.accountHolder, upiId: dest.upiId }
          : {
              accountHolder: dest.accountHolder,
              accountNumber: dest.accountNumber,
              ifsc: dest.ifsc,
              bankName: dest.bankName,
            };
      return api.post('/wallet/withdraw', { goldAmount: amount, method, destination });
    },
    onSuccess: () => {
      toast.success('Withdrawal request submitted');
      setGoldAmount('');
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['my-withdrawals'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const minGold = publicSettings.data?.withdraw?.minGold ?? 1000;
  const defaultTab = isHost ? 'withdraw' : 'buy';

  return (
    <div>
      <PageHeader
        title="Wallet"
        subtitle={
          isHost
            ? 'Gold earnings, withdrawals, and diamonds for host-to-host connects'
            : 'Buy diamonds to chat and call people & hosts'
        }
      />
      <div className="space-y-8 p-6">
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
            <p className="mt-2 text-xs text-white/40">
              {isHost ? 'Spend to message & call other hosts' : 'Spend on chat, calls & gifts'}
            </p>
          </div>
          {isHost && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 text-amber-400">
                <Coins className="h-6 w-6" />
                <span className="text-sm text-white/60">Gold balance</span>
              </div>
              {wallet.isLoading ? (
                <Skeleton className="mt-3 h-9 w-24" />
              ) : (
                <p className="mt-2 text-4xl font-extrabold">{formatCompact(wallet.data?.gold ?? 0)}</p>
              )}
              <p className="mt-2 text-xs text-white/40">
                Withdraw as cash when you reach {minGold} gold
              </p>
            </div>
          )}
        </div>

        {isHost && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/80">
            You earn gold when users message, call, or gift you. Buy diamonds below to call and
            message other hosts and normal users.
          </div>
        )}

        {publicSettings.data?.diamondConversions && (
          <div className="rounded-2xl border border-brand-blue/20 bg-brand-blue/5 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-brand-blue">
              <Gem className="h-5 w-5" />
              Diamond conversions
            </h3>
            <p className="mt-1 text-sm text-white/45">What 1 diamond gets you on Kushlov</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!isHost && (
                <>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
                      With hosts
                    </p>
                    <ul className="space-y-2 text-sm text-white/80">
                      {[
                        publicSettings.data.diamondConversions.hostVideo?.label ??
                          publicSettings.data.diamondConversions.video?.label,
                        publicSettings.data.diamondConversions.hostAudio?.label ??
                          publicSettings.data.diamondConversions.audio?.label,
                        publicSettings.data.diamondConversions.hostMessages?.label ??
                          publicSettings.data.diamondConversions.messages?.label,
                      ]
                        .filter(Boolean)
                        .map((label) => (
                          <li key={String(label)} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                            {label}
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
                      With users
                    </p>
                    <ul className="space-y-2 text-sm text-white/80">
                      {[
                        publicSettings.data.diamondConversions.userVideo?.label,
                        publicSettings.data.diamondConversions.userAudio?.label,
                        publicSettings.data.diamondConversions.userMessages?.label,
                      ]
                        .filter(Boolean)
                        .map((label) => (
                          <li key={String(label)} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-pink" />
                            {label}
                          </li>
                        ))}
                    </ul>
                  </div>
                </>
              )}
              {isHost && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
                    Host → Host
                  </p>
                  <ul className="space-y-2 text-sm text-white/80">
                    {[
                      publicSettings.data.diamondConversions.hostHostVideo?.label,
                      publicSettings.data.diamondConversions.hostHostAudio?.label,
                      publicSettings.data.diamondConversions.hostHostMessages?.label,
                    ]
                      .filter(Boolean)
                      .map((label) => (
                        <li key={String(label)} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                          {label}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="buy">Buy diamonds</TabsTrigger>
            {isHost && <TabsTrigger value="withdraw">Withdraw</TabsTrigger>}
            {isHost && <TabsTrigger value="withdrawals">My requests</TabsTrigger>}
            <TabsTrigger value="history">{isHost ? 'History' : 'History'}</TabsTrigger>
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

          {isHost && (
            <TabsContent value="withdraw" className="mt-6">
              <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-white/10 bg-card p-6">
                <div className="flex items-center gap-3">
                  <Banknote className="h-6 w-6 text-amber-400" />
                  <div>
                    <h3 className="font-semibold">Request withdrawal</h3>
                    <p className="text-sm text-white/45">Minimum {minGold} gold per request</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Payment method</Label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as WithdrawMethod)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                  >
                    {WITHDRAW_METHODS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-card">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Gold amount</Label>
                  <Input
                    type="number"
                    min={minGold}
                    placeholder={`Min ${minGold}`}
                    value={goldAmount}
                    onChange={(e) => setGoldAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Account holder name</Label>
                  <Input
                    value={dest.accountHolder}
                    onChange={(e) => setDest({ ...dest, accountHolder: e.target.value })}
                  />
                </div>

                {method === 'upi' ? (
                  <div className="space-y-1.5">
                    <Label>UPI ID</Label>
                    <Input
                      placeholder="name@upi"
                      value={dest.upiId}
                      onChange={(e) => setDest({ ...dest, upiId: e.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Bank name</Label>
                      <Input
                        value={dest.bankName}
                        onChange={(e) => setDest({ ...dest, bankName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Account number</Label>
                      <Input
                        value={dest.accountNumber}
                        onChange={(e) => setDest({ ...dest, accountNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>IFSC code</Label>
                      <Input
                        value={dest.ifsc}
                        onChange={(e) => setDest({ ...dest, ifsc: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <Button
                  className="w-full"
                  loading={withdraw.isPending}
                  onClick={() => withdraw.mutate()}
                >
                  Submit withdrawal request
                </Button>
              </div>
            </TabsContent>
          )}

          {isHost && (
            <TabsContent value="withdrawals" className="mt-6">
              <div className="space-y-2">
                {withdrawals.data?.items.map((w) => (
                  <div
                    key={w._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-card p-4"
                  >
                    <div>
                      <p className="font-medium">
                        {w.goldAmount} gold → {formatPrice(w.fiatAmount)}
                      </p>
                      <p className="text-xs capitalize text-white/40">
                        {w.method.replace(/_/g, ' ')} · {relativeTime(w.createdAt)}
                      </p>
                    </div>
                    <Badge variant={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'destructive' : 'warning'}>
                      {w.status}
                    </Badge>
                  </div>
                ))}
                {withdrawals.data?.items.length === 0 && (
                  <p className="py-12 text-center text-white/40">No withdrawal requests yet.</p>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="history" className="mt-6">
            <div className="space-y-2">
              {(isHost ? goldTxns.data?.items : diamondTxns.data?.items)?.map((t) => (
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
                    {t.amount} {isHost ? '🪙' : '💎'}
                  </p>
                </div>
              ))}
              {isHost && (diamondTxns.data?.items?.length ?? 0) > 0 && (
                <div className="pt-4">
                  <p className="mb-2 text-sm font-medium text-white/50">Diamond activity</p>
                  {diamondTxns.data?.items.map((t) => (
                    <div
                      key={`d-${t._id}`}
                      className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
                    >
                      <div>
                        <p className="font-medium capitalize">{t.reason.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-white/40">{relativeTime(t.createdAt)}</p>
                      </div>
                      <p className={t.direction === 'credit' ? 'text-emerald-400' : 'text-red-400'}>
                        {t.direction === 'credit' ? '+' : '-'}
                        {t.amount} 💎
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {(isHost ? goldTxns.data?.items : diamondTxns.data?.items)?.length === 0 && (
                <p className="py-12 text-center text-white/40">No transactions yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
