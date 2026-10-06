'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Radio, Eye, Play, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Paginated } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { UserAvatar } from '@/components/common/user-avatar';
import { getPremiumAvatar } from '@/lib/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LiveCardPreview } from '@/components/live/live-card-preview';

interface LiveItem {
  _id: string;
  title: string;
  status?: string;
  viewerCount: number;
  totalLikes?: number;
  thumbnailUrl?: string;
  host: {
    displayName: string;
    username: string;
    avatarUrl?: string;
    isHostApproved?: boolean;
  };
}

export function LandingLiveStreams() {
  const router = useRouter();
  const isLoggedIn = Boolean(useAuthStore((s) => s.accessToken));

  const { data, isLoading } = useQuery({
    queryKey: ['landing-live-streams'],
    queryFn: () => unwrap<Paginated<LiveItem>>(api.get('/live')),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const lives = (data?.items ?? []).filter(
    (l) => l.status === 'live' && (l.host as any)?.role !== 'admin',
  );

  const handleJoin = (streamId: string) => {
    if (!isLoggedIn) {
      toast.info('Please log in to join the live stream', {
        description: 'Log in or create a profile to chat and send gifts!',
      });
      router.push(`/login?next=/live/${streamId}`);
      return;
    }
    router.push(`/live/${streamId}`);
  };

  return (
    <section id="live" className="container py-12 md:py-16 scroll-mt-20">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-red-400 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Live Broadcasts
        </div>
        <h2 className="mt-3 text-2xl font-bold md:text-3xl lg:text-4xl">
          Watch <span className="text-gradient">Live Streams</span>
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-white/55">
          Join host live rooms, chat in real time, and connect through interactive streams.
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && lives.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3.5">
          {lives.map((stream) => (
            <article
              key={stream._id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand-pink/50 hover:shadow-xl hover:shadow-brand-pink/15"
            >
              {/* Live Video Preview Media Container */}
              <div
                onClick={() => handleJoin(stream._id)}
                className="relative aspect-video w-full cursor-pointer overflow-hidden bg-black"
              >
                <LiveCardPreview
                  liveId={stream._id}
                  thumbnailUrl={
                    stream.thumbnailUrl ||
                    stream.host?.avatarUrl ||
                    getPremiumAvatar(stream.host?.displayName || stream.host?.username)
                  }
                  active={true}
                />

                {/* Badges Overlay */}
                <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between pointer-events-none">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md backdrop-blur-sm">
                    <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-md">
                    <Eye className="h-2.5 w-2.5 text-brand-pink" />
                    {stream.viewerCount ?? 0}
                  </span>
                </div>

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-white shadow-md shadow-brand-pink/40">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-white" />
                  </div>
                </div>
              </div>

              {/* Host and Stream Details - Compact Width */}
              <div className="flex flex-1 flex-col gap-1.5 p-2 sm:p-2.5">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={stream.host?.displayName}
                    src={stream.host?.avatarUrl}
                    className="h-7 w-7 ring-1 ring-brand-pink/40 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {stream.host?.displayName ?? 'Host'}
                    </p>
                    <p className="truncate text-[10px] text-white/45">
                      @{stream.host?.username ?? 'live'}
                    </p>
                  </div>
                </div>

                <p className="line-clamp-1 text-[11px] text-white/70">{stream.title}</p>

                <div className="mt-auto pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleJoin(stream._id)}
                    className="h-7 w-full gap-1 text-[11px] font-medium shadow-sm py-0"
                  >
                    <Radio className="h-3 w-3" />
                    Watch
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!isLoading && lives.length === 0 && (
        <div className="glass relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center md:p-12">
          <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-10 blur-3xl" />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-xl shadow-brand-pink/25">
            <Radio className="h-8 w-8 text-white" />
          </div>
          <h3 className="mt-5 text-2xl font-bold md:text-3xl">Live Streaming Rooms</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/60 md:text-base">
            Verified hosts go live around the clock. Watch HD video broadcasts, chat in real time, and
            support your favorite creators with animated gifts.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => {
                if (!isLoggedIn) {
                  toast.info('Please log in to explore live streams');
                  router.push('/login?next=/live');
                } else {
                  router.push('/live');
                }
              }}
              className="gap-2 shadow-lg shadow-brand-pink/25 hover:shadow-brand-pink/40"
            >
              <Radio className="h-4 w-4" />
              Explore Live Rooms
            </Button>
            <Link href="/register?type=host">
              <Button size="lg" variant="secondary">
                Go Live as a Host
              </Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
