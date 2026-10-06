'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Heart,
  MessageCircle,
  Video,
  PhoneCall,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Role, type PublicUser } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { UserAvatar } from '@/components/common/user-avatar';
import { OnlineStatus } from '@/components/common/online-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getPremiumAvatar } from '@/lib/avatar';

export function LandingActiveNow() {
  const router = useRouter();
  const isLoggedIn = Boolean(useAuthStore((s) => s.accessToken));

  const { data, isLoading } = useQuery({
    queryKey: ['landing-active-users'],
    queryFn: () => unwrap<{ items: PublicUser[] }>(api.get('/settings/active-users')),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const users = (data?.items ?? [])
    .filter((u) => (u.role as string) !== 'admin')
    .sort((a, b) => {
      const aOnline = Boolean(a.isOnline);
      const bOnline = Boolean(b.isOnline);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return 0;
    });

  const handleAction = (user: PublicUser, action: 'like' | 'message' | 'video' | 'audio') => {
    if (!isLoggedIn) {
      toast.info(`Please log in to connect with ${user.displayName || 'users'}`, {
        description: 'Sign in to start chatting, calling, and sharing moments.',
      });
      router.push(`/login?next=/u/${user.id}`);
      return;
    }

    if (action === 'message') {
      router.push(`/messages?userId=${user.id}`);
    } else if (action === 'video' || action === 'audio') {
      if (user.isBusy) {
        toast.warning(`${user.displayName} is currently busy`);
        return;
      }
      router.push(`/u/${user.id}`);
    } else {
      router.push(`/u/${user.id}`);
    }
  };

  return (
    <section id="active-now" className="container py-12 md:py-16 scroll-mt-20">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row md:items-end mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 backdrop-blur-md shadow-sm shadow-emerald-500/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Active Now
          </div>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl lg:text-4xl">
            Connect With People <span className="text-gradient">Active Now</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            Real people and verified hosts online right now. Start an instant chat, voice, or video conversation.
          </p>
        </div>

        <Link href="/discover" className="shrink-0">
          <Button variant="secondary" size="sm" className="gap-2 group">
            Explore All
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
          {users.slice(0, 18).map((u) => {
            const isHost = u.role === Role.Host && u.isHostApproved;
            const isOnline = Boolean(u.isOnline);

            return (
              <article
                key={u.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-card/60 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                {/* Profile Media Preview - Compact */}
                <Link
                  href={`/u/${u.id}`}
                  className="relative block aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-brand-purple/30 to-brand-pink/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(u.avatarUrl && u.avatarUrl.trim()) || getPremiumAvatar(u.displayName || u.username, u.id)}
                    alt={u.displayName}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />

                  {/* Presence Status Badge */}
                  <div className="absolute left-2 top-2">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md backdrop-blur-md">
                        <span className="relative flex h-1 w-1">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-1 w-1 rounded-full bg-white" />
                        </span>
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-md">
                        <span className="h-1 w-1 rounded-full bg-white/40" />
                        Active
                      </span>
                    )}
                  </div>

                  {/* Host or Rating Badge */}
                  <div className="absolute right-2 top-2">
                    {isHost ? (
                      <Badge
                        variant="success"
                        className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0 shadow"
                      >
                        Host
                      </Badge>
                    ) : (u.averageRating ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300 backdrop-blur-md">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {u.averageRating?.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </Link>

                {/* Card Body - Compact */}
                <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
                  <Link href={`/u/${u.id}`} className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-xs font-semibold text-white leading-tight">
                        {u.displayName}
                      </p>
                      {isHost && (
                        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="truncate text-[10px] text-white/45">@{u.username}</p>
                    <OnlineStatus online={u.isOnline} busy={u.isBusy} className="text-[10px]" />
                  </Link>

                  {/* Quick Action Bar - Compact */}
                  <div className="mt-auto grid grid-cols-4 gap-1 pt-1.5">
                    <Button
                      size="icon"
                      className="h-7 w-full touch-manipulation shadow-sm"
                      onClick={() => handleAction(u, 'like')}
                      aria-label="Like profile"
                      title="Like"
                    >
                      <Heart className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-full touch-manipulation"
                      onClick={() => handleAction(u, 'message')}
                      aria-label="Send message"
                      title="Message"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-full touch-manipulation"
                      onClick={() => handleAction(u, 'video')}
                      aria-label="Video call"
                      title={u.isBusy ? 'User is busy' : 'Video call'}
                    >
                      <Video className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-full touch-manipulation"
                      onClick={() => handleAction(u, 'audio')}
                      aria-label="Voice call"
                      title={u.isBusy ? 'User is busy' : 'Voice call'}
                    >
                      <PhoneCall className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
