'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { PublicUser } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { UserAvatar } from '@/components/common/user-avatar';
import { StarRatingDisplay } from '@/components/common/star-rating';
import { OnlineStatus } from '@/components/common/online-status';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export function LandingPopularHosts() {
  const { data, isLoading } = useQuery({
    queryKey: ['popular-hosts'],
    queryFn: () => unwrap<{ items: PublicUser[] }>(api.get('/settings/popular-hosts')),
    staleTime: 60_000,
  });

  const hosts = data?.items ?? [];
  if (!isLoading && hosts.length === 0) return null;

  return (
    <section id="popular-hosts" className="container py-16 scroll-mt-20">
      <div className="mb-10 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-brand-pink/80">
          <Sparkles className="h-4 w-4" /> Featured
        </p>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">
          Popular <span className="text-gradient">hosts</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-white/55">
          Meet standout verified hosts hand-picked by our team — ready to chat, call, and go live.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}

        {hosts.map((h) => (
          <Link
            key={h.id}
            href={`/u/${h.id}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/60 transition duration-200 hover:-translate-y-1 hover:border-brand-pink/40 hover:shadow-lg hover:shadow-brand-pink/10"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-purple/30 to-brand-pink/20">
              {h.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.avatarUrl}
                  alt={h.displayName}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserAvatar name={h.displayName} className="h-14 w-14 text-xl" />
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                Popular
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="truncate font-semibold">{h.displayName}</p>
              <p className="truncate text-xs text-white/45">@{h.username}</p>
              <OnlineStatus online={h.isOnline} />
              <StarRatingDisplay
                className="mt-0.5"
                rating={h.averageRating ?? 0}
                count={h.totalReviews ?? 0}
              />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/discover">
          <Button size="lg" variant="secondary">
            Discover more hosts
          </Button>
        </Link>
      </div>
    </section>
  );
}
