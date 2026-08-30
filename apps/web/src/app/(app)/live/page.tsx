'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Radio, Users, Eye, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/common/user-avatar';
import { LiveCardPreview } from '@/components/live/live-card-preview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Live {
  _id: string;
  title: string;
  status?: string;
  viewerCount: number;
  totalLikes: number;
  thumbnailUrl?: string;
  host: { displayName: string; username: string; avatarUrl?: string };
}

const MAX_PREVIEWS = 4;

export default function LivePage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q.trim());
  const isApprovedHost = user?.role === 'host' && user?.isHostApproved;

  const { data, isLoading } = useQuery({
    queryKey: ['live', deferredQ],
    queryFn: () =>
      unwrap<Paginated<Live>>(api.get('/live', { params: { q: deferredQ || undefined } })),
    refetchInterval: 15000,
  });

  const lives = useMemo(
    () => (data?.items ?? []).filter((l) => l.status === 'live'),
    [data?.items],
  );

  const goLive = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('title', title || 'Live now');
      if (thumbnail) form.append('thumbnail', thumbnail);
      return api.post('/live/start', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      toast.success('You are live!');
      router.push(`/live/${res.data.data.live._id}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Live"
        subtitle={
          isApprovedHost
            ? 'Start a stream or watch other hosts. Nearby lives stay hidden until you search the host’s name.'
            : 'Watch hosts streaming right now. Nearby lives stay hidden — search a host’s name to find them.'
        }
        action={
          isApprovedHost && (
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Radio className="h-4 w-4" /> Go Live
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start a live stream</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Stream title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                />
                <Button onClick={() => goLive.mutate()} loading={goLive.isPending}>
                  Start streaming
                </Button>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="px-6 pt-2">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search host name…"
            className="pl-9"
            aria-label="Search live hosts"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-2xl" />
          ))}

        {lives.map((live, index) => (
          <Link
            key={live._id}
            href={`/live/${live._id}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-card"
          >
            <div className="relative aspect-video overflow-hidden bg-black">
              <LiveCardPreview
                liveId={live._id}
                thumbnailUrl={live.thumbnailUrl}
                active={index < MAX_PREVIEWS}
              />
              <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
              </span>
              <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs">
                <Eye className="h-3 w-3" /> {live.viewerCount}
              </span>
            </div>
            <div className="flex items-center gap-3 p-4">
              <UserAvatar name={live.host?.displayName} src={live.host?.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{live.title}</p>
                <p className="truncate text-xs text-white/40">@{live.host?.username}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && lives.length === 0 && (
        <div className="flex flex-col items-center py-24 text-white/40">
          <Users className="h-10 w-10" />
          <p className="mt-3">
            {deferredQ
              ? 'No live host matches that name.'
              : 'No live streams right now. Hosts within 10 km stay hidden — search their name to watch.'}
          </p>
        </div>
      )}
    </div>
  );
}
