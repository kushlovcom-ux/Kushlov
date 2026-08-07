'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Gender, Role, type PublicUser } from '@kushlov/types';
import { formatCompact } from '@kushlov/utils';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { CountrySelect } from '@/components/ui/country-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type AdminUserDetail = {
  user: PublicUser & { _id?: string };
  wallet: {
    diamonds: number;
    gold: number;
    totalDiamondsPurchased: number;
    totalGoldEarned: number;
    totalGoldWithdrawn: number;
  };
  location: {
    label: string;
    city: string | null;
    country: string | null;
    updatedAt: string | null;
  };
  profile: {
    bio?: string;
    gender?: string;
    dob?: string | null;
    languages?: string[];
  };
};

type FormState = {
  displayName: string;
  username: string;
  email: string;
  bio: string;
  gender: string;
  country: string;
  isHostApproved: boolean;
  videoPrice: number;
  audioPrice: number;
  messagePrice: number;
  isPopularHost: boolean;
  popularSortOrder: number;
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => unwrap<AdminUserDetail>(api.get(`/admin/users/${id}`)),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      displayName: data.user.displayName ?? '',
      username: data.user.username ?? '',
      email: data.user.email ?? '',
      bio: data.profile?.bio ?? data.user.bio ?? '',
      gender: data.profile?.gender ?? data.user.gender ?? '',
      country: data.user.country ?? 'India',
      isHostApproved: Boolean(data.user.isHostApproved),
      videoPrice: data.user.videoPrice ?? 0,
      audioPrice: data.user.audioPrice ?? 0,
      messagePrice: data.user.messagePrice ?? 0,
      isPopularHost: Boolean(data.user.isPopularHost),
      popularSortOrder: data.user.popularSortOrder ?? 0,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: (body: FormState) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      toast.success('User details saved');
      qc.invalidateQueries({ queryKey: ['admin-user', id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (isLoading || !form) {
    return (
      <div className="p-6">
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <PageHeader title="User not found" />
        <Button variant="secondary" onClick={() => router.push('/admin/users')}>
          Back to users
        </Button>
      </div>
    );
  }

  const u = data.user;
  const isHost = u.role === Role.Host;

  return (
    <div>
      <PageHeader
        title={u.displayName}
        subtitle={`@${u.username} · ${u.email}`}
        action={
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: 'secondary' }))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-5 flex items-center gap-4">
              <UserAvatar name={u.displayName} src={u.avatarUrl} className="h-16 w-16" />
              <div>
                <p className="text-lg font-semibold">{u.displayName}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {u.role}
                  </Badge>
                  <Badge
                    variant={
                      u.status === 'active'
                        ? 'success'
                        : u.status === 'banned'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {u.status}
                  </Badge>
                  {u.isOnline ? <Badge variant="success">Online</Badge> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) => set('displayName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm"
                >
                  <option value="">Not set</option>
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g}>
                      {g.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <CountrySelect
                  value={form.country}
                  onChange={(v) => set('country', v)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {(u.role === Role.User || isHost) && (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
                <p className="text-sm font-medium text-white/80">Homepage</p>
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Popular</p>
                    <p className="text-xs text-white/45">
                      Show this {isHost ? 'host' : 'user'} in Popular on web and app home
                    </p>
                  </div>
                  <Switch
                    checked={form.isPopularHost}
                    onCheckedChange={(v) => set('isPopularHost', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Popular sort order</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.popularSortOrder}
                    onChange={(e) => set('popularSortOrder', Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            {isHost ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
                <p className="text-sm font-medium text-white/80">Host settings</p>
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Host approved</p>
                    <p className="text-xs text-white/45">Allow this account to host</p>
                  </div>
                  <Switch
                    checked={form.isHostApproved}
                    onCheckedChange={(v) => set('isHostApproved', v)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Video price (gold)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.videoPrice}
                      onChange={(e) => set('videoPrice', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audio price (gold)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.audioPrice}
                      onChange={(e) => set('audioPrice', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message price (gold)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.messagePrice}
                      onChange={(e) => set('messagePrice', Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <Button
                className="bg-brand-gradient"
                loading={save.isPending}
                onClick={() => save.mutate(form)}
              >
                Save changes
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-sm font-medium text-white/70">Balances (read-only)</p>
            <p className="mt-1 text-xs text-white/40">
              Diamonds and gold cannot be edited here. Use Send diamonds to credit diamonds.
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="text-xs text-white/45">Diamonds</p>
                <p className="text-2xl font-bold">{formatCompact(data.wallet.diamonds)}</p>
              </div>
              {isHost ? (
                <div className="rounded-xl bg-white/5 px-4 py-3">
                  <p className="text-xs text-white/45">Gold</p>
                  <p className="text-2xl font-bold text-amber-300">
                    {formatCompact(data.wallet.gold)}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Earned {formatCompact(data.wallet.totalGoldEarned)} · Withdrawn{' '}
                    {formatCompact(data.wallet.totalGoldWithdrawn)}
                  </p>
                </div>
              ) : null}
              <div className="rounded-xl bg-white/5 px-4 py-3">
                <p className="text-xs text-white/45">Diamonds purchased (lifetime)</p>
                <p className="text-lg font-semibold">
                  {formatCompact(data.wallet.totalDiamondsPurchased)}
                </p>
              </div>
            </div>
            <Link
              href="/admin/diamonds"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-4 w-full')}
            >
              Send diamonds
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-sm font-medium text-white/70">Current location (read-only)</p>
            <p className="mt-3 text-base font-medium">{data.location.label}</p>
            {(data.location.city || data.location.country) && (
              <p className="mt-1 text-sm text-white/45">
                {[data.location.city, data.location.country].filter(Boolean).join(', ')}
              </p>
            )}
            {data.location.updatedAt ? (
              <p className="mt-2 text-xs text-white/35">
                Updated {new Date(data.location.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-card p-5 text-sm text-white/55">
            <p>Joined {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</p>
            <p className="mt-1">Last seen {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
