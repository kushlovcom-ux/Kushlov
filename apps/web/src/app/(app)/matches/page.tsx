'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import type { PublicUser, Paginated } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface MatchItem {
  matchId: string;
  matchedAt: string;
  user: PublicUser & { _id: string };
}

export default function MatchesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => unwrap<Paginated<MatchItem>>(api.get('/social/matches')),
  });

  return (
    <div>
      <PageHeader title="Matches" subtitle="People you both liked" />
      <div className="p-6">
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Heart className="h-12 w-12 text-brand-pink" />
            <p className="mt-4 text-white/50">No matches yet. Keep discovering!</p>
            <Link href="/discover" className="mt-4">
              <Button>Discover people</Button>
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((m) => (
            <div
              key={m.matchId}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-4"
            >
              <UserAvatar
                name={m.user?.displayName}
                src={m.user?.avatarUrl}
                online={m.user?.isOnline}
                className="h-14 w-14"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.user?.displayName}</p>
                <p className="truncate text-xs text-white/40">@{m.user?.username}</p>
              </div>
              <Link href={`/messages?to=${m.user?._id ?? m.user?.id}`}>
                <Button size="sm">Message</Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
