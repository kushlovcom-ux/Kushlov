'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Search, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicUser, Paginated } from '@kushlov/types';
import { formatDistanceKm } from '@kushlov/utils';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LocationSetup } from '@/components/location/location-setup';

type DiscoverUser = PublicUser & { distanceKm?: number };

export default function DiscoverPage() {
  const [q, setQ] = useState('');
  const qc = useQueryClient();

  const location = useQuery({
    queryKey: ['my-location'],
    queryFn: () =>
      unwrap<{ hasLocation: boolean; discoveryRadiusKm: number }>(api.get('/users/me/location')),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['discover', q],
    queryFn: () => unwrap<Paginated<DiscoverUser>>(api.get('/users', { params: { q, limit: 24 } })),
    enabled: location.data?.hasLocation === true,
  });

  const like = useMutation({
    mutationFn: (userId: string) => api.post(`/social/like/${userId}`),
    onSuccess: (res) => {
      const matched = res.data?.data?.matched;
      toast[matched ? 'success' : 'message'](matched ? "It's a match! 🎉" : 'Liked 💖');
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const radius = location.data?.discoveryRadiusKm ?? 20;
  const needsLocation = !location.isLoading && !location.data?.hasLocation;

  return (
    <div>
      <PageHeader
        title="Discover"
        subtitle={`People & hosts more than ${radius} km from you`}
        action={
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              className="pl-9"
              disabled={needsLocation}
            />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {needsLocation && (
          <div className="rounded-2xl border border-brand-pink/30 bg-brand-pink/5 p-4">
            <p className="font-medium">Set your location to start discovering</p>
            <p className="mt-1 text-sm text-white/50">
              Kushlov uses{' '}
              <a
                href="https://www.openstreetmap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-pink hover:underline"
              >
                OpenStreetMap
              </a>{' '}
              so users within {radius} km are hidden — you only see and connect with people farther away.
            </p>
          </div>
        )}

        {(needsLocation || location.data?.hasLocation) && (
          <LocationSetup compact={location.data?.hasLocation} />
        )}

        {!needsLocation && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
                ))}

              {data?.items.map((u) => (
                <div
                  key={u.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card"
                >
                  <Link href={`/u/${u.id}`}>
                    <div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-br from-brand-purple/30 to-brand-pink/20">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <UserAvatar name={u.displayName} className="h-20 w-20 text-2xl" />
                      )}
                    </div>
                  </Link>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold">{u.displayName}</p>
                      {u.isOnline && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                    </div>
                    <p className="truncate text-xs text-white/50">@{u.username}</p>
                    {u.distanceKm != null && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-brand-pink">
                        <MapPin className="h-3 w-3" />
                        {formatDistanceKm(u.distanceKm)}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => like.mutate(u.id)}
                        aria-label="Like"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                      <Link href={`/messages?to=${u.id}`}>
                        <Button size="icon" variant="secondary" className="h-8 w-8" aria-label="Message">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!isLoading && !error && data?.items.length === 0 && (
              <p className="py-12 text-center text-white/40">
                No users found more than {radius} km away. Try updating your location on the map above.
              </p>
            )}

            {error && (
              <p className="py-8 text-center text-sm text-red-400">{apiError(error)}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
