'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, PhoneCall, Video, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { CallType, Role, type PublicUser } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { startCall } from '@/lib/start-call';
import { useAuthStore } from '@/store/auth';
import { UserAvatar } from '@/components/common/user-avatar';
import { StarRatingDisplay } from '@/components/common/star-rating';
import { OnlineStatus } from '@/components/common/online-status';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getPremiumAvatar } from '@/lib/avatar';

export function LandingPopularHosts() {
  const router = useRouter();
  const qc = useQueryClient();
  const isLoggedIn = Boolean(useAuthStore((s) => s.accessToken));

  const { data, isLoading } = useQuery({
    queryKey: ['popular-hosts'],
    queryFn: () => unwrap<{ items: PublicUser[] }>(api.get('/settings/popular-hosts')),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  const like = useMutation({
    mutationFn: (userId: string) => api.post(`/social/like/${userId}`),
    onSuccess: (res) => {
      const matched = res.data?.data?.matched;
      toast[matched ? 'success' : 'message'](matched ? "It's a match! 🎉" : 'Liked 💖');
      qc.invalidateQueries({ queryKey: ['popular-hosts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  // Sort: filter out admin, any type of user online displays first, then others
  const sortedHosts = useMemo(() => {
    const raw = (data?.items ?? []).filter(
      (u) => (u.role as string) !== 'admin',
    );
    return [...raw].sort((a, b) => {
      const aOnline = Boolean(a.isOnline);
      const bOnline = Boolean(b.isOnline);
      if (aOnline !== bOnline) {
        return aOnline ? -1 : 1;
      }
      return 0;
    });
  }, [data?.items]);

  const handleAction = (u: PublicUser, action: 'like' | 'message' | 'video' | 'audio') => {
    if (!isLoggedIn) {
      toast.info('Please log in to connect with users');
      router.push(`/login?next=/u/${u.id}`);
      return;
    }

    if (action === 'like') {
      like.mutate(u.id);
    } else if (action === 'message') {
      router.push(`/messages?to=${u.id}`);
    } else if (action === 'video') {
      startCall(CallType.Video, u.id, u.displayName, {
        peerIsHost: u.role === Role.Host && !!u.isHostApproved,
        peerRole: u.role,
        peerHostApproved: u.isHostApproved,
      });
    } else if (action === 'audio') {
      startCall(CallType.Audio, u.id, u.displayName, {
        peerIsHost: u.role === Role.Host && !!u.isHostApproved,
        peerRole: u.role,
        peerHostApproved: u.isHostApproved,
      });
    }
  };

  if (!isLoading && sortedHosts.length === 0) return null;

  return (
    <section id="popular-hosts" className="container py-16 scroll-mt-20">
      <div className="mb-10 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-brand-pink/80">
          <Sparkles className="h-4 w-4" /> Featured
        </p>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">
          <span className="text-gradient">Popular</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-white/55">
          Meet standout people hand-picked by our team — ready to chat, call, and connect.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}

        {sortedHosts.map((u) => {
          const showHostRating = u.role === Role.Host;

          return (
            <article
              key={u.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg hover:shadow-brand-pink/10"
            >
              <Link
                href={`/u/${u.id}`}
                className="relative block aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-brand-purple/30 to-brand-pink/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(u.avatarUrl && u.avatarUrl.trim()) || getPremiumAvatar(u.displayName || u.username, u.id)}
                  alt={u.displayName}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                {u.role === Role.Host && u.isHostApproved ? (
                  <Badge
                    variant="success"
                    className="absolute left-2 top-2 text-[10px] uppercase tracking-wide"
                  >
                    Host
                  </Badge>
                ) : (
                  <span className="absolute left-2 top-2 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                    Popular
                  </span>
                )}
              </Link>

              <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
                <Link href={`/u/${u.id}`} className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {u.displayName}
                  </p>
                  <p className="truncate text-[11px] text-white/45">@{u.username}</p>
                  <OnlineStatus online={u.isOnline} busy={u.isBusy} />
                </Link>

                {showHostRating && (
                  <StarRatingDisplay
                    rating={u.averageRating ?? 0}
                    count={u.totalReviews ?? 0}
                  />
                )}

                <div className="mt-auto grid grid-cols-4 gap-1 pt-1">
                  <Button
                    size="icon"
                    className="h-8 w-full touch-manipulation"
                    onClick={() => handleAction(u, 'like')}
                    aria-label="Like"
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-full touch-manipulation"
                    onClick={() => handleAction(u, 'message')}
                    aria-label="Message"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-full touch-manipulation"
                    aria-label="Video call"
                    title={u.isBusy ? 'User is busy' : 'Video call'}
                    onClick={() => handleAction(u, 'video')}
                  >
                    <Video className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-full touch-manipulation"
                    aria-label="Audio call"
                    title={u.isBusy ? 'User is busy' : 'Audio call'}
                    onClick={() => handleAction(u, 'audio')}
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Link href="/discover">
          <Button size="lg" variant="secondary">
            Discover more
          </Button>
        </Link>
      </div>
    </section>
  );
}
