'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Radio, Users, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/common/user-avatar';
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
  viewerCount: number;
  totalLikes: number;
  thumbnailUrl?: string;
  host: { displayName: string; username: string; avatarUrl?: string };
}

export default function LivePage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const isApprovedHost = user?.role === 'host' && user?.isHostApproved;

  const { data, isLoading } = useQuery({
    queryKey: ['live'],
    queryFn: () => unwrap<Paginated<Live>>(api.get('/live')),
    refetchInterval: 15000,
  });

  const goLive = useMutation({
    mutationFn: () => api.post('/live/start', { title: title || 'Live now' }),
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
        subtitle="Watch hosts streaming right now"
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
                <Button onClick={() => goLive.mutate()} loading={goLive.isPending}>
                  Start streaming
                </Button>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-2xl" />
          ))}

        {data?.items.map((live) => (
          <Link
            key={live._id}
            href={`/live/${live._id}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-card"
          >
            <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-brand-purple/40 to-brand-pink/30">
              {live.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={live.thumbnailUrl} alt={live.title} className="h-full w-full object-cover" />
              ) : (
                <Radio className="h-10 w-10 text-white/60" />
              )}
              <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
              </span>
              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs">
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

      {!isLoading && data?.items.length === 0 && (
        <div className="flex flex-col items-center py-24 text-white/40">
          <Users className="h-10 w-10" />
          <p className="mt-3">No live streams right now. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
