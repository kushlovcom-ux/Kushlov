'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gem, Minus, Plus } from 'lucide-react';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, relativeTime } from '@/lib/utils';

type GrantRow = {
  id: string;
  amount: number;
  direction?: 'credit' | 'debit';
  action?: string;
  balanceAfter: number;
  note?: string;
  adminEmail?: string;
  adminName?: string;
  createdAt: string;
  user?: {
    _id?: string;
    displayName?: string;
    username?: string;
    email?: string;
  };
};

type Mode = 'grant' | 'cut';

export default function AdminDiamondsPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('grant');
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [amount, setAmount] = useState('100');
  const [note, setNote] = useState('');

  const search = useQuery({
    queryKey: ['admin-diamond-user-search', userQuery],
    queryFn: () =>
      unwrap<{ items: any[] }>(
        api.get('/admin/users', { params: { q: userQuery, limit: 8 } }),
      ),
    enabled: userQuery.trim().length >= 2,
  });

  const grants = useQuery({
    queryKey: ['admin-diamond-grants'],
    queryFn: () =>
      unwrap<{ items: GrantRow[] }>(api.get('/admin/diamonds/grants', { params: { limit: 50 } })),
  });

  const mutate = useMutation({
    mutationFn: () =>
      api.post(mode === 'grant' ? '/admin/diamonds/grant' : '/admin/diamonds/cut', {
        userId: selectedUserId,
        amount: Number(amount),
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? (mode === 'grant' ? 'Diamonds granted' : 'Diamonds removed'));
      setAmount('100');
      setNote('');
      setSelectedUserId('');
      setSelectedLabel('');
      setUserQuery('');
      qc.invalidateQueries({ queryKey: ['admin-diamond-grants'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Diamonds"
        subtitle="Add or remove diamonds from any user and review adjustment history"
      />

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gem className="h-4 w-4 text-brand-pink" />
            Adjust diamonds
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'grant' ? 'default' : 'secondary'}
              className={cn(mode === 'grant' && 'bg-brand-gradient')}
              onClick={() => setMode('grant')}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
            <Button
              size="sm"
              variant={mode === 'cut' ? 'default' : 'secondary'}
              className={cn(mode === 'cut' && 'bg-red-600 hover:bg-red-600')}
              onClick={() => setMode('cut')}
            >
              <Minus className="mr-1 h-4 w-4" />
              Cut
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Find user</Label>
            <Input
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setSelectedUserId('');
                setSelectedLabel('');
              }}
              placeholder="Search name, username, or email…"
            />
            {search.data?.items?.length ? (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                {search.data.items.map((u: any) => {
                  const id = u.id ?? u._id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                      onClick={() => {
                        setSelectedUserId(id);
                        setSelectedLabel(`${u.displayName} (@${u.username})`);
                        setUserQuery(`${u.displayName} (@${u.username})`);
                      }}
                    >
                      <span className="font-medium">{u.displayName}</span>
                      <span className="text-xs text-white/45">
                        @{u.username} · {u.email} · {u.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {selectedUserId && (
              <p className="text-xs text-emerald-300">Selected: {selectedLabel}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'grant' ? 'Reason for this grant…' : 'Reason for this cut…'}
            />
          </div>

          <Button
            loading={mutate.isPending}
            disabled={!selectedUserId || !Number(amount)}
            variant={mode === 'cut' ? 'destructive' : 'default'}
            className={mode === 'grant' ? 'bg-brand-gradient' : undefined}
            onClick={() => mutate.mutate()}
          >
            {mode === 'grant' ? 'Send diamonds' : 'Cut diamonds'}
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="mb-4 text-sm font-medium">Recent admin adjustments</p>
          {grants.isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="mb-2 h-14 w-full rounded-xl" />
            ))}
          <div className="space-y-2">
            {grants.data?.items?.map((g) => {
              const isCut = g.direction === 'debit' || g.action === 'cut';
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {g.user?.displayName ?? 'User'}{' '}
                        <span className="text-white/40">@{g.user?.username}</span>
                      </p>
                      <p className="text-xs text-white/45">{g.user?.email}</p>
                      {g.note && <p className="mt-1 text-xs text-white/60">Note: {g.note}</p>}
                      {(g.adminEmail || g.adminName) && (
                        <p className="mt-1 text-[11px] text-white/35">
                          By {g.adminName || g.adminEmail}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-semibold',
                          isCut ? 'text-red-300' : 'text-brand-pink',
                        )}
                      >
                        {isCut ? '−' : '+'}
                        {g.amount}
                      </p>
                      <p className="text-[11px] text-white/40">{relativeTime(g.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!grants.isLoading && (grants.data?.items?.length ?? 0) === 0 && (
              <p className="py-8 text-center text-sm text-white/40">No diamond adjustments yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
