'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Heart, MessageCircle, PhoneCall, Video, Flag, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { CallType } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => unwrap<any>(api.get(`/users/${id}`)),
  });

  const act = (fn: () => Promise<unknown>, msg: string) => async () => {
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const startCall = useMutation({
    mutationFn: (type: CallType) => api.post('/calls/initiate', { type, calleeId: id }),
    onSuccess: () => toast.success('Calling…'),
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading) return <Skeleton className="m-6 h-64 rounded-2xl" />;
  const u = data?.user;
  const profile = data?.profile;

  return (
    <div>
      <PageHeader title={u?.displayName ?? 'Profile'} />
      <div className="mx-auto max-w-2xl p-6">
        <div className="glass overflow-hidden rounded-3xl">
          <div className="h-40 bg-brand-gradient" />
          <div className="p-6">
            <div className="-mt-16 flex items-end justify-between">
              <UserAvatar name={u?.displayName} src={u?.avatarUrl} online={u?.isOnline} className="h-24 w-24 border-4 border-background text-3xl" />
              {u?.isHostApproved && <Badge variant="success">Verified Host</Badge>}
            </div>
            <h2 className="mt-4 text-2xl font-bold">{u?.displayName}</h2>
            <p className="text-white/40">@{u?.username}</p>
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
              <Button variant="secondary" onClick={() => startCall.mutate(CallType.Audio)}>
                <PhoneCall className="h-4 w-4" /> Audio
              </Button>
              <Button variant="secondary" onClick={() => startCall.mutate(CallType.Video)}>
                <Video className="h-4 w-4" /> Video
              </Button>
              {u?.isHostApproved && (
                <Button variant="outline" onClick={act(() => api.post(`/social/follow/${id}`), 'Following')}>
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
      </div>
    </div>
  );
}
