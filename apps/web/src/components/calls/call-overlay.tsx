'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { CallType, Role, SocketEvents } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useSocket } from '@/components/socket-provider';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/common/user-avatar';
import { PostCallReviewDialog } from '@/components/calls/post-call-review-dialog';
import { AddCallParticipant } from '@/components/calls/add-call-participant';

const LiveKitStage = dynamic(
  () => import('@/components/live/livekit-stage').then((m) => m.LiveKitStage),
  { ssr: false, loading: () => <div className="skeleton h-full min-h-[240px] w-full rounded-2xl" /> },
);

type IncomingInvite = {
  callId: string;
  type: CallType;
  roomName: string;
  interrupt?: boolean;
  targetCallId?: string;
  from: {
    id?: string;
    displayName?: string;
    avatarUrl?: string;
    role?: Role | string;
    isHostApproved?: boolean;
  };
  maxDurationSec?: number;
};

type ActiveCall = {
  callId: string;
  type: CallType;
  roomName: string;
  token: string;
  livekitUrl?: string;
  maxDurationSec: number;
  peerName: string;
  peerId?: string;
  peerIsHost: boolean;
  role: 'caller' | 'callee';
};

type ReviewPrompt = { hostId: string; hostName: string };

function isApprovedHostPeer(role?: string, isHostApproved?: boolean) {
  return role === Role.Host && isHostApproved !== false;
}

/**
 * Global incoming/outgoing call UI, plus optional post-call host review for normal users.
 */
export function CallOverlay() {
  const { socket, connected } = useSocket();
  const user = useAuthStore((s) => s.user);
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const [outgoing, setOutgoing] = useState<{
    callId: string;
    type: CallType;
    peerName: string;
    peerId: string;
    peerIsHost: boolean;
    token: string;
    roomName: string;
    livekitUrl?: string;
    maxDurationSec: number;
  } | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [reviewPrompt, setReviewPrompt] = useState<ReviewPrompt | null>(null);
  const warnedRef = useRef(false);
  const activeRef = useRef<ActiveCall | null>(null);
  const endingRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const offerReviewIfEligible = useCallback(
    (call: ActiveCall | null | undefined) => {
      if (!call?.peerId || !call.peerIsHost) return;
      if (user?.role !== Role.User) return;
      setReviewPrompt({ hostId: call.peerId, hostName: call.peerName || 'Host' });
    },
    [user?.role],
  );

  const endActive = useCallback(
    async (call?: ActiveCall | null) => {
      const c = call ?? activeRef.current;
      if (!c || endingRef.current) return;
      endingRef.current = true;
      try {
        await api.post(`/calls/${c.type}/${c.callId}/end`);
      } catch {
        /* already ended */
      }
      offerReviewIfEligible(c);
      setActive(null);
      setOutgoing(null);
      setRemainingSec(null);
      warnedRef.current = false;
      endingRef.current = false;
    },
    [offerReviewIfEligible],
  );

  useEffect(() => {
    if (!socket || !user) return;

    const onInvite = (payload: IncomingInvite) => {
      if (user.role === 'admin') return;
      setIncoming(payload);
      toast(payload.interrupt ? 'Call waiting' : 'Incoming call', {
        description: `${payload.from?.displayName ?? 'Someone'} is calling (${payload.type})`,
      });
    };

    const onAccept = (payload: {
      callId: string;
      type: CallType;
      roomName: string;
      token: string;
      livekitUrl?: string;
      maxDurationSec?: number;
      interrupt?: boolean;
    }) => {
      setOutgoing((prev) => {
        if (!prev) return prev;
        // Interrupt merge: C was waiting; join the target ongoing room.
        if (payload.interrupt || prev.callId === payload.callId || payload.token) {
          setActive({
            callId: payload.callId,
            type: payload.type ?? prev.type,
            roomName: payload.roomName ?? prev.roomName,
            token: payload.token,
            livekitUrl: payload.livekitUrl ?? prev.livekitUrl,
            maxDurationSec: payload.maxDurationSec ?? prev.maxDurationSec,
            peerName: prev.peerName,
            peerId: prev.peerId,
            peerIsHost: prev.peerIsHost,
            role: 'caller',
          });
          return null;
        }
        return prev;
      });
    };

    const onReject = (payload?: { interrupt?: boolean }) => {
      setOutgoing(null);
      toast.error(payload?.interrupt ? 'Call waiting declined' : 'Call declined');
    };

    const onEnd = () => {
      const ended = activeRef.current;
      setActive(null);
      setOutgoing(null);
      setIncoming(null);
      setRemainingSec(null);
      toast.message('Call ended');
      if (!endingRef.current) offerReviewIfEligible(ended);
    };

    const onParticipantLeft = (payload: {
      userId?: string;
      endedForYou?: boolean;
      callId?: string;
    }) => {
      if (payload.endedForYou) {
        setActive(null);
        setOutgoing(null);
        toast.message('You were removed from the call');
        return;
      }
      toast.message('A participant left the call');
    };

    socket.on(SocketEvents.CallInvite, onInvite);
    socket.on(SocketEvents.CallWaiting, onInvite);
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onReject);
    socket.on(SocketEvents.CallEnd, onEnd);
    socket.on(SocketEvents.CallParticipantLeft, onParticipantLeft);

    return () => {
      socket.off(SocketEvents.CallInvite, onInvite);
      socket.off(SocketEvents.CallWaiting, onInvite);
      socket.off(SocketEvents.CallAccept, onAccept);
      socket.off(SocketEvents.CallReject, onReject);
      socket.off(SocketEvents.CallEnd, onEnd);
      socket.off(SocketEvents.CallParticipantLeft, onParticipantLeft);
    };
  }, [socket, user, offerReviewIfEligible]);

  // HTTP poll for incoming / call-waiting (also while already on a call).
  useEffect(() => {
    if (!user || user.role === 'admin') return;
    if (connected && !active) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const data = await unwrap<{ items: IncomingInvite[] }>(api.get('/calls/incoming'));
        const next = data.items?.[0];
        if (!cancelled && next) {
          if (active && !next.interrupt) return;
          setIncoming((prev) => {
            if (prev?.callId === next.callId) return prev;
            toast(next.interrupt ? 'Call waiting' : 'Incoming call', {
              description: `${next.from?.displayName ?? 'Someone'} is calling (${next.type})`,
            });
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(poll, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, connected, incoming, active]);

  // Poll outgoing call until accepted/rejected when sockets are unavailable.
  useEffect(() => {
    if (!outgoing || connected) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await unwrap<{
          status: string;
          token?: string;
          roomName?: string;
          livekitUrl?: string;
          maxDurationSec?: number;
        }>(api.get(`/calls/${outgoing.type}/${outgoing.callId}`));

        if (cancelled) return;
        if (data.status === 'ongoing' && data.token) {
          setActive({
            callId: outgoing.callId,
            type: outgoing.type,
            roomName: data.roomName ?? outgoing.roomName,
            token: data.token,
            livekitUrl: data.livekitUrl ?? outgoing.livekitUrl,
            maxDurationSec: data.maxDurationSec ?? outgoing.maxDurationSec,
            peerName: outgoing.peerName,
            peerId: outgoing.peerId,
            peerIsHost: outgoing.peerIsHost,
            role: 'caller',
          });
          setOutgoing(null);
        } else if (data.status === 'rejected' || data.status === 'missed' || data.status === 'failed') {
          setOutgoing(null);
          toast.error('Call declined');
        } else if (data.status === 'ended') {
          setOutgoing(null);
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [outgoing, connected]);

  // Countdown for diamond-limited calls.
  useEffect(() => {
    if (!active?.maxDurationSec) {
      setRemainingSec(null);
      return;
    }
    setRemainingSec(active.maxDurationSec);
    warnedRef.current = false;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const left = Math.max(0, active.maxDurationSec - elapsed);
      setRemainingSec(left);
      if (left === 30 && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning('30 seconds remaining');
      }
      if (left <= 0) {
        window.clearInterval(timer);
        void endActive(active);
        toast.error('Call ended — diamonds expired');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, endActive]);

  // Expose a small imperative helper via custom event for discover/profile.
  useEffect(() => {
    const handler = async (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        type: CallType;
        calleeId: string;
        peerName: string;
        peerIsHost?: boolean;
        peerRole?: string;
        peerHostApproved?: boolean;
        participantIds?: string[];
      };
      try {
        const data = await unwrap<{
          call?: { _id: string };
          callId?: string;
          token?: string;
          roomName?: string;
          livekitUrl?: string;
          maxDurationSec?: number;
          busy?: boolean;
          interrupt?: boolean;
          message?: string;
        }>(
          api.post('/calls/initiate', {
            type: detail.type,
            calleeId: detail.calleeId,
            participantIds: detail.participantIds?.length
              ? [detail.calleeId, ...detail.participantIds]
              : undefined,
          }),
        );
        const peerIsHost =
          detail.peerIsHost ??
          isApprovedHostPeer(detail.peerRole, detail.peerHostApproved ?? true);
        const callId = data.call?._id ?? data.callId;
        if (!callId) throw new Error('No call id');

        if (data.busy || data.interrupt) {
          setOutgoing({
            callId,
            type: detail.type,
            peerName: detail.peerName,
            peerId: detail.calleeId,
            peerIsHost,
            token: data.token ?? '',
            roomName: data.roomName ?? '',
            livekitUrl: data.livekitUrl,
            maxDurationSec: data.maxDurationSec ?? 0,
          });
          toast.message(data.message ?? 'User is busy on another call', {
            description: 'Waiting if they accept…',
          });
          return;
        }

        setOutgoing({
          callId,
          type: detail.type,
          peerName: detail.peerName,
          peerId: detail.calleeId,
          peerIsHost,
          token: data.token!,
          roomName: data.roomName!,
          livekitUrl: data.livekitUrl,
          maxDurationSec: data.maxDurationSec!,
        });
        toast.success('Calling…');
      } catch (e) {
        toast.error(apiError(e));
      }
    };
    window.addEventListener('kushlov:start-call', handler);
    return () => window.removeEventListener('kushlov:start-call', handler);
  }, []);

  const accept = async () => {
    if (!incoming) return;
    try {
      const path = incoming.interrupt
        ? `/calls/${incoming.type}/${incoming.callId}/accept-interrupt`
        : `/calls/${incoming.type}/${incoming.callId}/accept`;
      const data = await unwrap<{
        token: string;
        roomName: string;
        livekitUrl?: string;
        maxDurationSec: number;
        call?: { _id?: string };
        type?: CallType;
        merged?: boolean;
      }>(api.post(path));

      if (active && incoming.interrupt) {
        setActive({
          ...active,
          callId: data.call?._id ?? active.callId,
          type: data.type ?? active.type,
          roomName: data.roomName ?? active.roomName,
          token: data.token || active.token,
          livekitUrl: data.livekitUrl ?? active.livekitUrl,
          maxDurationSec: data.maxDurationSec ?? active.maxDurationSec,
        });
        setIncoming(null);
        toast.success('Merged into your call');
        return;
      }

      setActive({
        callId: data.call?._id ?? incoming.callId,
        type: incoming.type,
        roomName: data.roomName,
        token: data.token,
        livekitUrl: data.livekitUrl,
        maxDurationSec: data.maxDurationSec,
        peerName: incoming.from?.displayName ?? 'Caller',
        peerId: incoming.from?.id,
        peerIsHost: isApprovedHostPeer(incoming.from?.role, incoming.from?.isHostApproved),
        role: 'callee',
      });
      setIncoming(null);
    } catch (e) {
      toast.error(apiError(e));
      setIncoming(null);
    }
  };

  const reject = async () => {
    if (!incoming) return;
    try {
      await api.post(`/calls/${incoming.type}/${incoming.callId}/reject`);
    } catch {
      /* ignore */
    }
    setIncoming(null);
  };

  const kickPeer = async () => {
    if (!active?.peerId) return;
    try {
      const res = await unwrap<{ ended?: boolean }>(
        api.post(`/calls/${active.type}/${active.callId}/participants/${active.peerId}/remove`),
      );
      toast.success(`Removed ${active.peerName}`);
      if (res.ended) {
        setActive(null);
        setOutgoing(null);
      }
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <>
      {(incoming || outgoing || active) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          {incoming && !active && (
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-card p-6 text-center shadow-2xl">
              <UserAvatar
                name={incoming.from?.displayName}
                src={incoming.from?.avatarUrl}
                className="mx-auto h-20 w-20 text-2xl"
              />
              <p className="mt-4 text-lg font-semibold">
                {incoming.from?.displayName ?? 'Incoming call'}
              </p>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-white/50">
                {incoming.type === CallType.Video ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                Incoming {incoming.type} call
                {incoming.interrupt ? ' (waiting)' : ''}
              </p>
              <div className="mt-6 flex justify-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    variant="destructive"
                    className="h-14 w-14 rounded-full"
                    onClick={() => void reject()}
                    aria-label="Decline"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                  <span className="text-xs text-red-400">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600"
                    onClick={() => void accept()}
                    aria-label="Accept"
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                  <span className="text-xs text-emerald-400">Accept</span>
                </div>
              </div>
            </div>
          )}

          {outgoing && !active && (
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-card p-6 text-center shadow-2xl">
              <p className="text-lg font-semibold">Calling {outgoing.peerName}…</p>
              <p className="mt-2 text-sm capitalize text-white/50">{outgoing.type} call</p>
              <Button
                className="mt-6"
                variant="destructive"
                onClick={() =>
                  void (async () => {
                    try {
                      await api.post(`/calls/${outgoing.type}/${outgoing.callId}/end`);
                    } catch {
                      /* ignore */
                    }
                    setOutgoing(null);
                  })()
                }
              >
                <PhoneOff className="h-4 w-4" /> Cancel
              </Button>
            </div>
          )}

          {active && (
            <div className="relative flex h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl">
              {incoming ? (
                <div className="absolute left-4 right-4 top-16 z-20 rounded-2xl border border-white/15 bg-black/85 p-4 text-center backdrop-blur">
                  <p className="font-semibold">
                    {incoming.from?.displayName ?? 'Someone'} is calling
                    {incoming.interrupt ? ' (waiting)' : ''}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Accept to merge into this call
                  </p>
                  <div className="mt-3 flex justify-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <Button size="sm" variant="destructive" onClick={() => void reject()}>
                        Decline
                      </Button>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600"
                        onClick={() => void accept()}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="font-semibold">{active.peerName}</p>
                  <p className="text-xs capitalize text-white/50">{active.type} call</p>
                </div>
                <div className="flex items-center gap-3">
                  {remainingSec != null && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        remainingSec <= 30
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}{' '}
                      left
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void endActive()}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 p-0">
                <LiveKitStage
                  token={active.token}
                  serverUrl={active.livekitUrl}
                  audioOnly={active.type === CallType.Audio}
                  isHost={active.role === 'callee'}
                  publish
                  showFilters={active.type === CallType.Video}
                  onDisconnected={() => void endActive()}
                />
              </div>
              <div className="flex flex-col items-center gap-2 border-t border-white/10 p-4">
                <AddCallParticipant callId={active.callId} type={active.type} />
                {active.peerId ? (
                  <Button size="sm" variant="secondary" onClick={() => void kickPeer()}>
                    End call for {active.peerName}
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => void endActive()}>
                  <PhoneOff className="h-4 w-4" /> End call
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <PostCallReviewDialog
        open={!!reviewPrompt}
        hostId={reviewPrompt?.hostId ?? ''}
        hostName={reviewPrompt?.hostName ?? 'Host'}
        onClose={() => setReviewPrompt(null)}
      />
    </>
  );
}

export { startCall } from '@/lib/start-call';
