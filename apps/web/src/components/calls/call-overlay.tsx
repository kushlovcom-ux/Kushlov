'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Ban,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Phone,
  PhoneOff,
  UserMinus,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { CallType, Role, SocketEvents } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useSocket } from '@/components/socket-provider';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/common/user-avatar';
import { PostCallReviewDialog } from '@/components/calls/post-call-review-dialog';
import { AddCallParticipant } from '@/components/calls/add-call-participant';
import { cn } from '@/lib/utils';

const INCOMING_RINGTONE_SRC = '/sounds/incoming-call.wav';

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

/** Loop a real ringtone asset while an incoming/waiting invite is open. */
function useCallRingtone(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const audio = new Audio(INCOMING_RINGTONE_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.55;

    const play = () => {
      void audio.play().catch(() => {
        /* autoplay may be blocked until a user gesture */
      });
    };

    play();
    const onGesture = () => play();
    window.addEventListener('pointerdown', onGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      audio.pause();
      audio.src = '';
      audio.load();
    };
  }, [enabled]);
}

/** Draggable floating card for in-call waiting invites. */
function DraggableWaitingCard({
  callId,
  boundsRef,
  children,
}: {
  callId: string;
  boundsRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  useEffect(() => {
    setPos(null);
  }, [callId]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;

    const card = cardRef.current;
    const bounds = boundsRef.current;
    if (!card || !bounds) return;

    const cardRect = card.getBoundingClientRect();
    const boundsRect = bounds.getBoundingClientRect();
    const originLeft = pos?.left ?? cardRect.left - boundsRect.left;
    const originTop = pos?.top ?? cardRect.top - boundsRect.top;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft,
      originTop,
    };
    if (!pos) setPos({ left: originLeft, top: originTop });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const card = cardRef.current;
    const bounds = boundsRef.current;
    if (!card || !bounds) return;

    const pad = 8;
    const boundsRect = bounds.getBoundingClientRect();
    const { width, height } = card.getBoundingClientRect();
    const maxLeft = Math.max(pad, boundsRect.width - width - pad);
    const maxTop = Math.max(pad, boundsRect.height - height - pad);
    const left = Math.min(
      maxLeft,
      Math.max(pad, drag.originLeft + (e.clientX - drag.startX)),
    );
    const top = Math.min(
      maxTop,
      Math.max(pad, drag.originTop + (e.clientY - drag.startY)),
    );
    setPos({ left, top });
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'absolute z-40 w-[min(100%,20rem)] touch-none',
        pos ? 'left-0 top-0' : 'right-3 top-16 sm:right-4 sm:top-20',
      )}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
    >
      <div
        className="rounded-2xl border border-white/15 bg-zinc-900/95 shadow-2xl backdrop-blur"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex cursor-grab items-center justify-center gap-1 border-b border-white/10 py-1.5 active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <GripHorizontal className="h-4 w-4 text-white/35" />
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
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
  const [expanded, setExpanded] = useState(false);
  const [browserFs, setBrowserFs] = useState(false);
  const warnedRef = useRef(false);
  const activeRef = useRef<ActiveCall | null>(null);
  const incomingRef = useRef<IncomingInvite | null>(null);
  const outgoingRef = useRef<{ callId: string } | null>(null);
  const endingRef = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useCallRingtone(Boolean(incoming));

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    incomingRef.current = incoming;
  }, [incoming]);
  useEffect(() => {
    outgoingRef.current = outgoing;
  }, [outgoing]);

  useEffect(() => {
    if (!active) {
      setExpanded(false);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    }
  }, [active]);

  useEffect(() => {
    const onFs = () => setBrowserFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Auto-dismiss waiting popup after 45s if ignored.
  useEffect(() => {
    if (!active || !incoming) {
      if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
      return;
    }
    waitingTimeoutRef.current = setTimeout(() => {
      void (async () => {
        const inv = incomingRef.current;
        if (!inv) return;
        try {
          await api.post(`/calls/${inv.type}/${inv.callId}/reject`);
        } catch {
          /* ignore */
        }
        setIncoming(null);
        toast.message('Missed call waiting');
      })();
    }, 45_000);
    return () => {
      if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
    };
  }, [active, incoming?.callId]);

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

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) {
      setExpanded((v) => !v);
      return;
    }
    try {
      if (!document.fullscreenElement) {
        setExpanded(true);
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
        setExpanded(false);
      }
    } catch {
      setExpanded((v) => !v);
    }
  }, []);

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

    const onReject = (payload?: { callId?: string; interrupt?: boolean }) => {
      const id = payload?.callId;
      setOutgoing((o) => {
        if (!o) return o;
        if (id && o.callId !== id) return o;
        return null;
      });
      setIncoming((i) => {
        if (!i) return i;
        if (id && i.callId !== id) return i;
        return null;
      });
      if (!id || outgoingRef.current?.callId === id || incomingRef.current?.callId === id) {
        toast.error(payload?.interrupt ? 'Call waiting declined' : 'Call declined');
      }
    };

    const onEnd = (payload?: { callId?: string; interrupt?: boolean }) => {
      const id = payload?.callId;
      const activeCall = activeRef.current;
      const out = outgoingRef.current;
      const inc = incomingRef.current;

      if (id && activeCall && id !== activeCall.callId) {
        setOutgoing((o) => (o?.callId === id ? null : o));
        setIncoming((i) => (i?.callId === id ? null : i));
        if (out?.callId === id) {
          toast.message(payload?.interrupt ? 'Call waiting ended' : 'Call ended');
        }
        return;
      }

      if (id && !activeCall && out && out.callId !== id && inc?.callId !== id) {
        return;
      }

      const ended = activeCall;
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

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    // When sockets are healthy and we are not mid-call, rely on realtime invites.
    if (connected && !active) return;

    let cancelled = false;
    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!useAuthStore.getState().accessToken) return;
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
    const id = window.setInterval(poll, connected ? 8_000 : 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // Intentionally omit `incoming` — including it restarted the interval every invite.
  }, [user, connected, active]);

  useEffect(() => {
    if (!outgoing || connected) return;
    let cancelled = false;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
    const id = window.setInterval(poll, 4_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [outgoing, connected]);

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

  const blockIncoming = async () => {
    if (!incoming?.from?.id) {
      await reject();
      return;
    }
    const userId = incoming.from.id;
    try {
      await api.post(`/calls/${incoming.type}/${incoming.callId}/reject`);
    } catch {
      /* ignore */
    }
    try {
      await api.post(`/moderation/block/${userId}`);
      toast.success('User blocked');
    } catch (e) {
      toast.error(apiError(e));
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

  const isFullscreen = expanded || browserFs;

  return (
    <>
      {(incoming || outgoing || active) && (
        <div
          className={cn(
            'fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm',
            isFullscreen && active ? 'p-0' : 'p-3 sm:p-4',
          )}
        >
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
            <div
              ref={shellRef}
              className={cn(
                'relative flex flex-col overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl',
                isFullscreen
                  ? 'h-[100dvh] w-screen rounded-none'
                  : 'h-[min(92dvh,820px)] w-full max-w-5xl rounded-3xl',
              )}
            >
              {/* In-call waiting card */}
              {incoming ? (
                <DraggableWaitingCard callId={incoming.callId} boundsRef={shellRef}>
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      name={incoming.from?.displayName}
                      src={incoming.from?.avatarUrl}
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {incoming.from?.displayName ?? 'Someone'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-white/55">
                        {incoming.type === CallType.Video ? (
                          <Video className="h-3 w-3" />
                        ) : (
                          <Phone className="h-3 w-3" />
                        )}
                        Incoming {incoming.type} call
                        {incoming.interrupt ? ' · waiting' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      className="h-9 bg-emerald-500 text-xs hover:bg-emerald-600"
                      onClick={() => void accept()}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9 text-xs"
                      onClick={() => void reject()}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 gap-1 text-xs"
                      onClick={() => void blockIncoming()}
                      disabled={!incoming.from?.id}
                    >
                      <Ban className="h-3 w-3" />
                      Block
                    </Button>
                  </div>
                </DraggableWaitingCard>
              ) : null}

              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{active.peerName}</p>
                  <p className="text-xs capitalize text-white/50">{active.type} call</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  {remainingSec != null && (
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium sm:text-xs',
                        remainingSec <= 30
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-white/10 text-white/70',
                      )}
                    >
                      {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}{' '}
                      left
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => void toggleFullscreen()}
                    aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                    title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => void endActive()}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Stage */}
              <div className="min-h-0 flex-1 bg-black">
                <LiveKitStage
                  token={active.token}
                  serverUrl={active.livekitUrl}
                  audioOnly={active.type === CallType.Audio}
                  isHost
                  publish
                  showAvControls
                  showFilters={active.type === CallType.Video}
                  videoFit="contain"
                  layout="speaker"
                  onDisconnected={() => void endActive()}
                />
              </div>

              {/* Compact horizontal toolbar */}
              <div className="border-t border-white/10 bg-zinc-950/95 px-2 py-2 sm:px-4">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
                  <AddCallParticipant
                    callId={active.callId}
                    type={active.type}
                    compact
                  />
                  {active.peerId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs hover:bg-white/15"
                      onClick={() => void kickPeer()}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      <span className="max-w-[9rem] truncate">
                        End for {active.peerName}
                      </span>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs hover:bg-white/15"
                    onClick={() => void toggleFullscreen()}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {isFullscreen ? 'Exit full' : 'Full screen'}
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 gap-1.5 rounded-full px-4 text-xs"
                    onClick={() => void endActive()}
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    End call
                  </Button>
                </div>
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
