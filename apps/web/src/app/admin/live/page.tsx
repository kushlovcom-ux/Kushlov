'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LiveStatus } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type LiveHost = {
  _id?: string;
  id?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

type LiveRow = {
  _id: string;
  title: string;
  status: string;
  viewerCount?: number;
  peakViewers?: number;
  totalLikes?: number;
  startedAt?: string;
  createdAt: string;
  thumbnailUrl?: string;
  host?: LiveHost;
  coHost?: LiveHost;
};

function hostId(u?: LiveHost) {
  return u?.id || u?._id || '';
}

export default function AdminLiveNowPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-live', LiveStatus.Live],
    queryFn: () =>
      unwrap<{ items: LiveRow[]; total: number }>(
        api.get('/admin/live', { params: { status: LiveStatus.Live, limit: 50 } }),
      ),
    refetchInterval: 10_000,
  });

  const endLive = useMutation({
    mutationFn: (id: string) => api.post(`/admin/live/${id}/force-end`),
    onSuccess: () => {
      toast.success('Stream ended');
      qc.invalidateQueries({ queryKey: ['admin-live'] });
      qc.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Live now"
        subtitle={`${data?.total ?? 0} stream${(data?.total ?? 0) === 1 ? '' : 's'} currently live`}
      />
      <div className="space-y-3 p-6">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}

        {items.map((live) => {
          const hid = hostId(live.host);
          return (
            <div
              key={live._id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-card p-4"
            >
              {live.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={live.thumbnailUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{live.title || 'Untitled live'}</p>
                  <Badge variant="destructive">Live</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/60">
                  {hid ? (
                    <Link href={`/admin/users/${hid}`} className="flex items-center gap-2 hover:text-white">
                      <UserAvatar
                        name={live.host?.displayName ?? 'Host'}
                        src={live.host?.avatarUrl}
                        className="h-7 w-7"
                      />
                      <span>{live.host?.displayName ?? 'Host'}</span>
                    </Link>
                  ) : (
                    <span>{live.host?.displayName ?? 'Host'}</span>
                  )}
                  {live.coHost ? (
                    <span className="text-white/40">
                      + {live.coHost.displayName ?? 'Co-host'}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {live.viewerCount ?? 0} watching · peak {live.peakViewers ?? 0} ·{' '}
                  {live.totalLikes ?? 0} likes · started{' '}
                  {relativeTime(live.startedAt ?? live.createdAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                loading={endLive.isPending}
                onClick={() => endLive.mutate(live._id)}
              >
                End stream
              </Button>
            </div>
          );
        })}

        {!isLoading && items.length === 0 && (
          <p className="py-16 text-center text-white/40">No one is live right now.</p>
        )}
      </div>
    </div>
  );
}
