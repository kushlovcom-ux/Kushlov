'use client';

import { useState, useEffect, useDeferredValue } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, PhoneCall, Search, MapPin, Video } from 'lucide-react';
import { toast } from 'sonner';
import { CallType, Role, type PublicUser, type Paginated } from '@kushlov/types';
import { formatDistanceKm } from '@kushlov/utils';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { StarRatingDisplay } from '@/components/common/star-rating';
import { startCall } from '@/lib/start-call';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LocationSetup } from '@/components/location/location-setup';
import { OnlineStatus } from '@/components/common/online-status';
import { GroupCallDialog } from '@/components/calls/group-call-dialog';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

type DiscoverUser = PublicUser & {
  distanceKm?: number;
  isBusy?: boolean;
  canInteract?: boolean;
};

export default function DiscoverPage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isNormalUser = me?.role === Role.User;
  const isHost = me?.role === Role.Host;

  useEffect(() => {
    const fromUrl = searchParams.get('q');
    if (fromUrl != null) setQ(fromUrl);
  }, [searchParams]);

  const location = useQuery({
    queryKey: ['my-location'],
    queryFn: () =>
      unwrap<{ hasLocation: boolean; discoveryRadiusKm: number }>(api.get('/users/me/location')),
    staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['discover', deferredQ],
    queryFn: () =>
      unwrap<Paginated<DiscoverUser>>(
        api.get('/users', { params: { q: deferredQ || undefined, limit: 24 } }),
      ),
    enabled: location.data?.hasLocation === true,
    staleTime: 10_000,
    refetchInterval: 60_000,
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

  const needsLocation = !location.isLoading && !location.data?.hasLocation;

  return (
    <div>
      <PageHeader
        title="Discover"
        subtitle={
          isHost ? 'Meet people and hosts ready to connect' : 'Discover hosts and people ready to connect'
        }
        action={
          <div className="flex w-full max-w-lg items-center gap-2">
            <GroupCallDialog />
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search locals within 10 km…"
                className="pl-9"
                disabled={needsLocation}
              />
            </div>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        {needsLocation && (
          <div className="rounded-2xl border border-brand-pink/30 bg-brand-pink/5 p-4">
            <p className="font-medium">Set your location to start discovering</p>
            <p className="mt-1 text-sm text-white/50">
              Add your location so we can show you great people nearby and help you make better matches.
            </p>
          </div>
        )}

        {(needsLocation || location.data?.hasLocation) && (
          <LocationSetup compact={location.data?.hasLocation} />
        )}

        {!needsLocation && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-[220px] rounded-2xl sm:h-[240px]" />
                ))}

              {data?.items.map((u) => {
                const showCallActions =
                  (isNormalUser &&
                    ((u.role === Role.Host && u.isHostApproved) || u.role === Role.User)) ||
                  (isHost &&
                    ((u.role === Role.Host && u.isHostApproved) || u.role === Role.User));
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
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt={u.displayName}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <UserAvatar name={u.displayName} className="h-12 w-12 text-lg sm:h-14 sm:w-14" />
                        </div>
                      )}
                      {u.role === Role.Host && u.isHostApproved && (
                        <Badge
                          variant="success"
                          className="absolute left-2 top-2 text-[10px] uppercase tracking-wide"
                        >
                          Host
                        </Badge>
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

                      {u.distanceKm != null && (
                        <p className="flex items-center gap-1 text-[10px] text-brand-pink">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {formatDistanceKm(u.distanceKm)}
                        </p>
                      )}

                      <div
                        className={cn(
                          'mt-auto grid gap-1 pt-0.5',
                          showCallActions ? 'grid-cols-4' : 'grid-cols-2',
                        )}
                      >
                        <Button
                          size="icon"
                          className="h-8 w-full touch-manipulation"
                          onClick={() => like.mutate(u.id)}
                          aria-label="Like"
                        >
                          <Heart className="h-3.5 w-3.5" />
                        </Button>
                        <Link href={`/messages?to=${u.id}`} className="block">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-full touch-manipulation"
                            aria-label="Message"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {showCallActions && (
                          <>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-full touch-manipulation"
                              aria-label="Video call"
                              title={
                                u.isBusy
                                  ? 'User is busy — they will get call waiting'
                                  : 'Video call'
                              }
                              onClick={() => {
                                startCall(CallType.Video, u.id, u.displayName, {
                                  peerIsHost: u.role === Role.Host && !!u.isHostApproved,
                                  peerRole: u.role,
                                  peerHostApproved: u.isHostApproved,
                                });
                              }}
                            >
                              <Video className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-full touch-manipulation"
                              aria-label="Audio call"
                              title={
                                u.isBusy
                                  ? 'User is busy — they will get call waiting'
                                  : 'Audio call'
                              }
                              onClick={() => {
                                startCall(CallType.Audio, u.id, u.displayName, {
                                  peerIsHost: u.role === Role.Host && !!u.isHostApproved,
                                  peerRole: u.role,
                                  peerHostApproved: u.isHostApproved,
                                });
                              }}
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!isLoading && !error && data?.items.length === 0 && (
              <p className="py-12 text-center text-white/40">
                {deferredQ.trim()
                  ? 'No one within 10 km matches that name. Try another search.'
                  : 'No matches right now. People within 10 km are hidden on browse — search by name to find them.'}
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
