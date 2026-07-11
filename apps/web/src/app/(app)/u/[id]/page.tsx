'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, PhoneCall, Video, Flag, Ban, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { CallType, Role, type HostReview, type Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { StarRatingDisplay, StarRatingInput } from '@/components/common/star-rating';
import { startCall } from '@/components/calls/call-overlay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OnlineStatus } from '@/components/common/online-status';
import { useAuthStore } from '@/store/auth';

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => unwrap<any>(api.get(`/users/${id}`)),
  });

  const reviews = useQuery({
    queryKey: ['host-reviews', id],
    queryFn: () =>
      unwrap<Paginated<HostReview> & { summary: { averageRating: number; totalReviews: number } }>(
        api.get(`/reviews/host/${id}`, { params: { limit: 20 } }),
      ),
    enabled: !!id,
  });

  const myReview = useQuery({
    queryKey: ['my-review', id],
    queryFn: () => unwrap<HostReview | null>(api.get(`/reviews/mine/${id}`)),
    enabled: !!id && me?.role === Role.User,
  });

  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (myReview.data && !prefilled) {
      setRating(myReview.data.rating);
      setText(myReview.data.text ?? '');
      setPrefilled(true);
    }
  }, [myReview.data, prefilled]);

  const act = (fn: () => Promise<unknown>, msg: string) => async () => {
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const saveReview = useMutation({
    mutationFn: () => api.post('/reviews', { hostId: id, rating, text }),
    onSuccess: () => {
      toast.success(myReview.data ? 'Review updated' : 'Review submitted');
      qc.invalidateQueries({ queryKey: ['host-reviews', id] });
      qc.invalidateQueries({ queryKey: ['my-review', id] });
      qc.invalidateQueries({ queryKey: ['user', id] });
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading) return <Skeleton className="m-6 h-64 rounded-2xl" />;
  const u = data?.user;
  const profile = data?.profile;
  const isHostProfile = u?.role === Role.Host && u?.isHostApproved;
  const isUserProfile = u?.role === Role.User;
  const canCall =
    me?.id !== id &&
    ((me?.role === Role.User && (isHostProfile || isUserProfile)) ||
      (me?.role === Role.Host && (isHostProfile || isUserProfile)));
  const canReview = me?.role === Role.User && isHostProfile && me.id !== id;

  return (
    <div>
      <PageHeader title={u?.displayName ?? 'Profile'} />
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div className="glass overflow-hidden rounded-3xl">
          <div className="h-40 bg-brand-gradient" />
          <div className="p-6">
            <div className="-mt-16 flex items-end justify-between">
              <UserAvatar
                name={u?.displayName}
                src={u?.avatarUrl}
                online={u?.isOnline}
                className="h-24 w-24 border-4 border-background text-3xl"
              />
              {u?.isHostApproved && <Badge variant="success">Verified Host</Badge>}
            </div>
            <h2 className="mt-4 text-2xl font-bold">{u?.displayName}</h2>
            <p className="text-white/40">@{u?.username}</p>
            <OnlineStatus online={u?.isOnline} size="md" className="mt-2" />

            {isHostProfile && (
              <div className="mt-3">
                <StarRatingDisplay
                  size="md"
                  rating={u?.averageRating ?? reviews.data?.summary?.averageRating ?? 0}
                  count={u?.totalReviews ?? reviews.data?.summary?.totalReviews ?? 0}
                />
              </div>
            )}

            {u?.bio && <p className="mt-3 text-white/70">{u.bio}</p>}
            {profile?.interests?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.interests.map((t: string) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={act(() => api.post(`/social/like/${id}`), 'Liked 💖')}>
                <Heart className="h-4 w-4" /> Like
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/messages?to=${id}`)}>
                <MessageCircle className="h-4 w-4" /> Message
              </Button>
              {canCall && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      startCall(CallType.Audio, id, u?.displayName ?? 'Host', {
                        peerIsHost: !!isHostProfile,
                        peerRole: u?.role,
                        peerHostApproved: u?.isHostApproved,
                      })
                    }
                  >
                    <PhoneCall className="h-4 w-4" /> Audio
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      startCall(CallType.Video, id, u?.displayName ?? 'Host', {
                        peerIsHost: !!isHostProfile,
                        peerRole: u?.role,
                        peerHostApproved: u?.isHostApproved,
                      })
                    }
                  >
                    <Video className="h-4 w-4" /> Video
                  </Button>
                </>
              )}
              {u?.isHostApproved && me?.role === Role.User && (
                <Button
                  variant="outline"
                  onClick={act(() => api.post(`/social/follow/${id}`), 'Following')}
                >
                  Follow
                </Button>
              )}
            </div>

            <div className="mt-6 flex gap-4 text-sm text-white/50">
              <button
                className="flex items-center gap-1 hover:text-white"
                onClick={act(
                  () => api.post('/moderation/report', { reportedUser: id, reason: 'Inappropriate' }),
                  'Reported',
                )}
              >
                <Flag className="h-4 w-4" /> Report
              </button>
              <button
                className="flex items-center gap-1 hover:text-white"
                onClick={act(() => api.post(`/moderation/block/${id}`), 'Blocked')}
              >
                <Ban className="h-4 w-4" /> Block
              </button>
            </div>
          </div>
        </div>

        {canReview && (
          <div className="rounded-3xl border border-brand-pink/30 bg-card p-5">
            <h3 className="text-lg font-semibold">
              {myReview.data ? 'Update your review' : 'Leave a review'}
            </h3>
            <p className="mt-1 text-sm text-white/45">
              Optional. You can also rate after an audio or video call.
            </p>
            <div className="mt-4 space-y-3">
              <StarRatingInput value={rating} onChange={setRating} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share your experience…"
                maxLength={1000}
                rows={3}
                className="flex w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
              />
              <Button loading={saveReview.isPending} onClick={() => saveReview.mutate()}>
                {myReview.data ? 'Update review' : 'Submit review'}
              </Button>
            </div>
          </div>
        )}

        {isHostProfile && (
          <div className="rounded-3xl border border-white/10 bg-card p-5">
            <h3 className="text-lg font-semibold">Reviews</h3>
            <div className="mt-4 space-y-4">
              {reviews.isLoading && <Skeleton className="h-20 w-full rounded-xl" />}
              {!reviews.isLoading && (reviews.data?.items?.length ?? 0) === 0 && (
                <p className="text-sm text-white/40">No reviews yet.</p>
              )}
              {reviews.data?.items?.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      name={r.reviewer.displayName}
                      src={r.reviewer.avatarUrl}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.reviewer.displayName}</p>
                        {r.reviewer.emailVerified && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <BadgeCheck className="h-3.5 w-3.5" /> Verified
                          </span>
                        )}
                        <span className="text-xs text-white/35">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <StarRatingDisplay rating={r.rating} className="mt-1" />
                      {r.text && <p className="mt-2 text-sm text-white/70">{r.text}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
