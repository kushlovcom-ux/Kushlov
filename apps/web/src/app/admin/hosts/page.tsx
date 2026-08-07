'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PublicUser, Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { UserAvatar } from '@/components/common/user-avatar';
import { StarRatingDisplay } from '@/components/common/star-rating';
import { Skeleton } from '@/components/ui/skeleton';

type Draft = { videoPrice: number; audioPrice: number; messagePrice: number };

export default function AdminHostsPricingPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sortDrafts, setSortDrafts] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-hosts', q],
    queryFn: () => unwrap<Paginated<PublicUser>>(api.get('/admin/hosts', { params: { q, limit: 50 } })),
  });

  const save = useMutation({
    mutationFn: ({ id, pricing }: { id: string; pricing: Draft }) =>
      api.patch(`/admin/hosts/${id}/pricing`, pricing),
    onSuccess: () => {
      toast.success('Host pricing saved');
      qc.invalidateQueries({ queryKey: ['admin-hosts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const setPopular = useMutation({
    mutationFn: ({
      id,
      isPopularHost,
      popularSortOrder,
    }: {
      id: string;
      isPopularHost: boolean;
      popularSortOrder?: number;
    }) => api.patch(`/admin/hosts/${id}/popular`, { isPopularHost, popularSortOrder }),
    onSuccess: () => {
      toast.success('Popular updated');
      qc.invalidateQueries({ queryKey: ['admin-hosts'] });
      qc.invalidateQueries({ queryKey: ['popular-hosts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const draftFor = (u: PublicUser): Draft =>
    drafts[u.id] ?? {
      videoPrice: u.videoPrice ?? 0,
      audioPrice: u.audioPrice ?? 0,
      messagePrice: u.messagePrice ?? 0,
    };

  const sortFor = (u: PublicUser) => sortDrafts[u.id] ?? u.popularSortOrder ?? 0;

  return (
    <div>
      <PageHeader
        title="Host pricing"
        subtitle="Set gold prices per host and choose who appears in Popular on the homepage"
        action={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hosts…"
            className="max-w-xs"
          />
        }
      />
      <div className="space-y-4 p-6">
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/80">
          Prices are in <strong>gold</strong>. Toggle <strong>Popular</strong> to feature a host on the
          homepage. Lower sort order appears first.
        </p>
        {isLoading && <Skeleton className="h-24 w-full rounded-2xl" />}
        {data?.items.map((u) => {
          const d = draftFor(u);
          const sort = sortFor(u);
          return (
            <div
              key={u.id}
              className="grid gap-4 rounded-2xl border border-white/10 bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <UserAvatar name={u.displayName} src={u.avatarUrl} className="h-12 w-12" />
                  <div>
                    <p className="font-semibold">{u.displayName}</p>
                    <p className="text-xs text-white/40">@{u.username}</p>
                    <StarRatingDisplay
                      className="mt-1"
                      rating={u.averageRating ?? 0}
                      count={u.totalReviews ?? 0}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!u.isPopularHost}
                      onCheckedChange={(v) =>
                        setPopular.mutate({
                          id: u.id,
                          isPopularHost: v,
                          popularSortOrder: sort,
                        })
                      }
                    />
                    <span className="text-sm text-white/70">Popular on homepage</span>
                  </div>
                  {u.isPopularHost && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/45">Sort</label>
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        value={sort}
                        onChange={(e) =>
                          setSortDrafts((prev) => ({ ...prev, [u.id]: +e.target.value }))
                        }
                        onBlur={() =>
                          setPopular.mutate({
                            id: u.id,
                            isPopularHost: true,
                            popularSortOrder: sort,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-white/45">Video gold/min</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={d.videoPrice}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [u.id]: { ...d, videoPrice: +e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/45">Audio gold/min</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={d.audioPrice}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [u.id]: { ...d, audioPrice: +e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/45">Message gold/msg</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={d.messagePrice}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [u.id]: { ...d, messagePrice: +e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    loading={save.isPending}
                    onClick={() => save.mutate({ id: u.id, pricing: d })}
                  >
                    Save pricing
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && data?.items.length === 0 && (
          <p className="py-12 text-center text-white/40">No approved hosts found.</p>
        )}
      </div>
    </div>
  );
}
