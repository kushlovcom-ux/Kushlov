'use client';

import { LiveKitStage } from '@/components/live/livekit-stage';
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
  Merge,
  Phone,
  PhoneOff,
  Pause,
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
  /** Remote participants currently on this LiveKit leg (for End-for-X). */
  participants: { id: string; name: string }[];
};

type HeldCall = {
  callId: string;
  type: CallType;
  peerName: string;
  peerId?: string;
  peerIsHost: boolean;
};

type ReviewPrompt = { hostId: string; hostName: string };

function rosterFromPeer(peerId?: string, peerName?: string): { id: string; name: string }[] {
  if (!peerId) return [];
  return [{ id: peerId, name: peerName || 'Peer' }];
}

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
  const [heldCall, setHeldCall] = useState<HeldCall | null>(null);
  const [parked, setParked] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [reviewPrompt, setReviewPrompt] = useState<ReviewPrompt | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [browserFs, setBrowserFs] = useState(false);
  const warnedRef = useRef(false);
  const activeRef = useRef<ActiveCall | null>(null);
  const heldCallRef = useRef<HeldCall | null>(null);
  const incomingRef = useRef<IncomingInvite | null>(null);
  const outgoingRef = useRef<{ callId: string } | null>(null);
  const endingRef = useRef(false);
  /** Skip end-on-disconnect while parking for consult / switching rooms. */
  const intentionalLeaveRef = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useCallRingtone(Boolean(incoming));

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    heldCallRef.current = heldCall;
  }, [heldCall]);
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
      intentionalLeaveRef.current = true;
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

  const endHeldOnly = useCallback(async () => {
    if (!heldCall) return;
    const held = heldCall;
    try {
      await api.post(`/calls/${held.type}/${held.callId}/end`);
    } catch {
      /* ignore */
    }
    setHeldCall(null);
    // Drop held peer from active roster / kick chip if still listed.
    setActive((prev) => {
      if (!prev || !held.peerId) return prev;
      const participants = prev.participants.filter((p) => p.id !== held.peerId);
      return {
        ...prev,
        participants,
        peerId: participants[0]?.id ?? (prev.peerId === held.peerId ? undefined : prev.peerId),
        peerName:
          participants.map((p) => p.name).join(' + ') ||
          (prev.peerId === held.peerId ? 'Call' : prev.peerName),
      };
    });
    toast.message(`Ended held call with ${held.peerName}`);
  }, [heldCall]);

  const mergeHeld = useCallback(async () => {
    if (!active || !heldCall) return;
    intentionalLeaveRef.current = true;
    try {
      const data = await unwrap<{
        token?: string;
        roomName?: string;
        livekitUrl?: string;
        maxDurationSec?: number;
        call?: { _id?: string };
        type?: CallType;
      }>(api.post(`/calls/${active.type}/${active.callId}/merge`, { heldCallId: heldCall.callId }));
      const participants = [...active.participants];
      if (heldCall.peerId && !participants.some((p) => p.id === heldCall.peerId)) {
        participants.push({ id: heldCall.peerId, name: heldCall.peerName });
      }
      setActive({
        ...active,
        callId: data.call?._id ?? active.callId,
        type: data.type ?? active.type,
        roomName: data.roomName ?? active.roomName,
        token: data.token || active.token,
        livekitUrl: data.livekitUrl ?? active.livekitUrl,
        maxDurationSec: data.maxDurationSec ?? active.maxDurationSec,
        peerName: participants.map((p) => p.name).join(' + ') || active.peerName,
        peerId: participants[0]?.id,
        participants,
      });
      setHeldCall(null);
      toast.success('Calls merged');
    } catch (e) {
      intentionalLeaveRef.current = false;
      toast.error(apiError(e));
    }
  }, [active, heldCall]);

  const endConsultAndResumeHeld = useCallback(async () => {
    const c = activeRef.current;
    const held = heldCall;
    if (!c) return;
    endingRef.current = true;
    intentionalLeaveRef.current = true;
    // Clear held first so CallEnd does not double-resume.
    setHeldCall(null);
    try {
      await api.post(`/calls/${c.type}/${c.callId}/end`);
    } catch {
      /* ignore */
    }
    offerReviewIfEligible(c);
    setActive(null);
    setOutgoing(null);
    setRemainingSec(null);
    endingRef.current = false;

    if (!held) return;
    try {
      const data = await unwrap<{
        token: string;
        roomName: string;
        livekitUrl?: string;
        maxDurationSec?: number;
      }>(api.post(`/calls/${held.type}/${held.callId}/unhold`));
      setActive({
        callId: held.callId,
        type: held.type,
        roomName: data.roomName,
        token: data.token,
        livekitUrl: data.livekitUrl,
        maxDurationSec: data.maxDurationSec ?? 0,
        peerName: held.peerName,
        peerId: held.peerId,
        peerIsHost: held.peerIsHost,
        role: 'caller',
        participants: rosterFromPeer(held.peerId, held.peerName),
      });
      toast.success(`Resumed call with ${held.peerName}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [heldCall, offerReviewIfEligible]);

  const endAllCalls = useCallback(async () => {
    const held = heldCall;
    if (held) {
      try {
        await api.post(`/calls/${held.type}/${held.callId}/end`);
      } catch {
        /* ignore */
      }
      setHeldCall(null);
    }
    await endActive();
  }, [heldCall, endActive]);

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
      mergedFromHold?: string;
      merged?: boolean;
      participant?: { id?: string; displayName?: string };
    }) => {
      const cur = activeRef.current;
      if (
        payload.mergedFromHold &&
        cur &&
        (cur.callId === payload.mergedFromHold || payload.token)
      ) {
        intentionalLeaveRef.current = true;
        setParked(false);
        setActive({
          ...cur,
          callId: payload.callId,
          type: payload.type ?? cur.type,
          roomName: payload.roomName ?? cur.roomName,
          token: payload.token || cur.token,
          livekitUrl: payload.livekitUrl ?? cur.livekitUrl,
          maxDurationSec: payload.maxDurationSec ?? cur.maxDurationSec,
        });
        toast.success('Joined merged call');
        return;
      }

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
            participants: rosterFromPeer(prev.peerId, prev.peerName),
          });
          return null;
        }
        return prev;
      });
    };

    const resumeHeldAfterConsultFail = async () => {
      const held = heldCallRef.current;
      if (!held) return;
      try {
        const data = await unwrap<{
          token: string;
          roomName: string;
          livekitUrl?: string;
          maxDurationSec?: number;
        }>(api.post(`/calls/${held.type}/${held.callId}/unhold`));
        setActive({
          callId: held.callId,
          type: held.type,
          roomName: data.roomName,
          token: data.token,
          livekitUrl: data.livekitUrl,
          maxDurationSec: data.maxDurationSec ?? 0,
          peerName: held.peerName,
          peerId: held.peerId,
          peerIsHost: held.peerIsHost,
          role: 'caller',
          participants: rosterFromPeer(held.peerId, held.peerName),
        });
        setHeldCall(null);
        toast.message(`Resumed call with ${held.peerName}`);
      } catch (e) {
        setHeldCall(null);
        toast.error(apiError(e));
      }
    };

    const onReject = (payload?: { callId?: string; interrupt?: boolean }) => {
      const id = payload?.callId;
      const outBefore = outgoingRef.current;
      const wasOutgoing = Boolean(!id || outBefore?.callId === id);
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
      if (!id || outBefore?.callId === id || incomingRef.current?.callId === id) {
        toast.error(payload?.interrupt ? 'Call waiting declined' : 'Call declined');
      }
      if (wasOutgoing && heldCallRef.current) {
        void resumeHeldAfterConsultFail();
      }
    };

    const onEnd = (payload?: { callId?: string; interrupt?: boolean }) => {
      const id = payload?.callId;
      const activeCall = activeRef.current;
      const held = heldCallRef.current;
      const out = outgoingRef.current;
      const inc = incomingRef.current;

      if (id && held && id === held.callId) {
        setHeldCall(null);
        toast.message(`Held call with ${held.peerName} ended`);
        return;
      }

      if (id && activeCall && id !== activeCall.callId) {
        setOutgoing((o) => (o?.callId === id ? null : o));
        setIncoming((i) => (i?.callId === id ? null : i));
        if (out?.callId === id) {
          toast.message(payload?.interrupt ? 'Call waiting ended' : 'Call ended');
          if (held) void resumeHeldAfterConsultFail();
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
      setParked(false);
      setRemainingSec(null);
      toast.message('Call ended');
      if (!endingRef.current) offerReviewIfEligible(ended);
      if (held && ended && id === ended.callId) {
        void resumeHeldAfterConsultFail();
      }
    };

    const onHold = (payload: { callId?: string; held?: boolean }) => {
      const cur = activeRef.current;
      if (!cur || (payload.callId && payload.callId !== cur.callId)) return;
      // Soft-disconnect media so hold is real (silence), without ending the call.
      intentionalLeaveRef.current = true;
      setParked(true);
      toast.message('You are on hold');
    };

    const onUnhold = (payload: {
      callId?: string;
      merged?: boolean;
      token?: string;
      roomName?: string;
      livekitUrl?: string;
      maxDurationSec?: number;
    }) => {
      if (payload.merged) {
        setParked(false);
        return;
      }
      const cur = activeRef.current;
      if (!cur || (payload.callId && payload.callId !== cur.callId)) return;
      setParked(false);
      if (payload.token) {
        intentionalLeaveRef.current = true;
        setActive({
          ...cur,
          token: payload.token,
          roomName: payload.roomName ?? cur.roomName,
          livekitUrl: payload.livekitUrl ?? cur.livekitUrl,
          maxDurationSec: payload.maxDurationSec ?? cur.maxDurationSec,
        });
      }
      toast.message('Call resumed');
    };

    const onParticipantJoined = (payload: {
      callId?: string;
      participant?: { id?: string; displayName?: string };
    }) => {
      const id = payload.participant?.id;
      if (!id) return;
      const name = payload.participant?.displayName ?? 'Peer';
      setActive((prev) => {
        if (!prev) return prev;
        if (payload.callId && payload.callId !== prev.callId) return prev;
        if (prev.participants.some((p) => p.id === id)) return prev;
        const participants = [...prev.participants, { id, name }];
        return {
          ...prev,
          participants,
          peerName: participants.map((p) => p.name).join(' + '),
          peerId: participants[0]?.id ?? prev.peerId,
        };
      });
    };

    const onParticipantLeft = (payload: {
      userId?: string;
      endedForYou?: boolean;
      callId?: string;
    }) => {
      if (payload.endedForYou) {
        intentionalLeaveRef.current = true;
        setActive(null);
        setOutgoing(null);
        setParked(false);
        toast.message('You were removed from the call');
        return;
      }
      const leftId = payload.userId;
      if (leftId) {
        setActive((prev) => {
          if (!prev) return prev;
          const participants = prev.participants.filter((p) => p.id !== leftId);
          return {
            ...prev,
            participants,
            peerId: participants[0]?.id,
            peerName: participants.map((p) => p.name).join(' + ') || 'Call',
          };
        });
      }
      toast.message('A participant left the call');
    };

    socket.on(SocketEvents.CallInvite, onInvite);
    socket.on(SocketEvents.CallWaiting, onInvite);
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onReject);
    socket.on(SocketEvents.CallEnd, onEnd);
    socket.on(SocketEvents.CallHold, onHold);
    socket.on(SocketEvents.CallUnhold, onUnhold);
    socket.on(SocketEvents.CallParticipantJoined, onParticipantJoined);
    socket.on(SocketEvents.CallParticipantLeft, onParticipantLeft);

    return () => {
      socket.off(SocketEvents.CallInvite, onInvite);
      socket.off(SocketEvents.CallWaiting, onInvite);
      socket.off(SocketEvents.CallAccept, onAccept);
      socket.off(SocketEvents.CallReject, onReject);
      socket.off(SocketEvents.CallEnd, onEnd);
      socket.off(SocketEvents.CallHold, onHold);
      socket.off(SocketEvents.CallUnhold, onUnhold);
      socket.off(SocketEvents.CallParticipantJoined, onParticipantJoined);
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
            participants: rosterFromPeer(outgoing.peerId, outgoing.peerName),
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
        fromCallId?: string;
      };
      if (activeRef.current && !detail.fromCallId) {
        toast.error('You are already on a call');
        return;
      }
      if (outgoingRef.current && !detail.fromCallId) {
        toast.error('A call is already ringing');
        return;
      }
      try {
        const body: Record<string, unknown> = {
          type: detail.type,
          calleeId: detail.calleeId,
        };
        if (detail.fromCallId) body.fromCallId = detail.fromCallId;
        if (detail.participantIds?.length) {
          body.participantIds = [detail.calleeId, ...detail.participantIds];
        }
        const data = await unwrap<{
          call?: { _id: string };
          callId?: string;
          token?: string;
          roomName?: string;
          livekitUrl?: string;
          maxDurationSec?: number;
          busy?: boolean;
          interrupt?: boolean;
          consult?: boolean;
          heldCallId?: string;
          heldType?: CallType;
          message?: string;
        }>(api.post('/calls/initiate', body));
        const peerIsHost =
          detail.peerIsHost ??
          isApprovedHostPeer(detail.peerRole, detail.peerHostApproved ?? true);
        const callId = data.call?._id ?? data.callId;
        if (!callId) throw new Error('No call id');

        if (data.consult && data.heldCallId && activeRef.current) {
          const prev = activeRef.current;
          intentionalLeaveRef.current = true;
          setHeldCall({
            callId: data.heldCallId,
            type: data.heldType ?? prev.type,
            peerName: prev.peerName,
            peerId: prev.peerId,
            peerIsHost: prev.peerIsHost,
          });
          setActive(null);
          setRemainingSec(null);
          toast.message(`On hold: ${prev.peerName}`, {
            description: `Calling ${detail.peerName}…`,
          });
        }

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
        if (!data.consult) toast.success('Calling…');
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
        const joinerId = incoming.from?.id;
        const joinerName = incoming.from?.displayName ?? 'Caller';
        const participants = [...active.participants];
        if (joinerId && !participants.some((p) => p.id === joinerId)) {
          participants.push({ id: joinerId, name: joinerName });
        }
        setActive({
          ...active,
          callId: data.call?._id ?? active.callId,
          type: data.type ?? active.type,
          roomName: data.roomName ?? active.roomName,
          token: data.token || active.token,
          livekitUrl: data.livekitUrl ?? active.livekitUrl,
          maxDurationSec: data.maxDurationSec ?? active.maxDurationSec,
          participants,
          peerName: participants.map((p) => p.name).join(' + ') || active.peerName,
          peerId: participants[0]?.id ?? active.peerId,
        });
        setIncoming(null);
        toast.success('Merged into your call');
        return;
      }

      const peerId = incoming.from?.id;
      const peerName = incoming.from?.displayName ?? 'Caller';
      setActive({
        callId: data.call?._id ?? incoming.callId,
        type: incoming.type,
        roomName: data.roomName,
        token: data.token,
        livekitUrl: data.livekitUrl,
        maxDurationSec: data.maxDurationSec,
        peerName,
        peerId,
        peerIsHost: isApprovedHostPeer(incoming.from?.role, incoming.from?.isHostApproved),
        role: 'callee',
        participants: rosterFromPeer(peerId, peerName),
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

  const kickParticipant = async (userId: string, name: string) => {
    if (!active) return;
    try {
      const res = await unwrap<{ ended?: boolean }>(
        api.post(`/calls/${active.type}/${active.callId}/participants/${userId}/remove`),
      );
      toast.success(`Ended call for ${name}`);
      if (res.ended) {
        intentionalLeaveRef.current = true;
        setActive(null);
        setOutgoing(null);
        return;
      }
      setActive((prev) => {
        if (!prev) return prev;
        const participants = prev.participants.filter((p) => p.id !== userId);
        return {
          ...prev,
          participants,
          peerId: participants[0]?.id,
          peerName: participants.map((p) => p.name).join(' + ') || 'Call',
        };
      });
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
              {heldCall ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-300/90">
                  <Pause className="h-3.5 w-3.5" />
                  On hold: {heldCall.peerName}
                </p>
              ) : null}
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
                    const held = heldCallRef.current;
                    if (!held) return;
                    try {
                      const data = await unwrap<{
                        token: string;
                        roomName: string;
                        livekitUrl?: string;
                        maxDurationSec?: number;
                      }>(api.post(`/calls/${held.type}/${held.callId}/unhold`));
                      setActive({
                        callId: held.callId,
                        type: held.type,
                        roomName: data.roomName,
                        token: data.token,
                        livekitUrl: data.livekitUrl,
                        maxDurationSec: data.maxDurationSec ?? 0,
                        peerName: held.peerName,
                        peerId: held.peerId,
                        peerIsHost: held.peerIsHost,
                        role: 'caller',
                        participants: rosterFromPeer(held.peerId, held.peerName),
                      });
                      setHeldCall(null);
                      toast.message(`Resumed call with ${held.peerName}`);
                    } catch (e) {
                      setHeldCall(null);
                      toast.error(apiError(e));
                    }
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
                    onClick={() => void (heldCall ? endAllCalls() : endActive())}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {parked ? (
                <div className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <Pause className="h-4 w-4 shrink-0" />
                  On hold — please wait
                </div>
              ) : null}

              {heldCall ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Pause className="h-4 w-4 shrink-0" />
                    <span className="truncate">On hold: {heldCall.peerName}</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 gap-1 rounded-full bg-emerald-600 px-2.5 text-xs hover:bg-emerald-500"
                      onClick={() => void mergeHeld()}
                    >
                      <Merge className="h-3.5 w-3.5" />
                      Merge
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 text-xs"
                      onClick={() => void endHeldOnly()}
                    >
                      End held
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1 rounded-full px-2.5 text-xs"
                      onClick={() => void endAllCalls()}
                    >
                      End all
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Stage */}
              <div className="min-h-0 flex-1 bg-black">
                {parked ? (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
                    <Pause className="h-10 w-10 text-amber-300/80" />
                    <p className="text-lg font-semibold text-amber-100">On hold</p>
                    <p className="max-w-sm text-sm text-white/50">
                      Please wait — the other person will reconnect you shortly.
                    </p>
                  </div>
                ) : (
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
                    onDisconnected={() => {
                      if (intentionalLeaveRef.current) {
                        intentionalLeaveRef.current = false;
                        return;
                      }
                      void (heldCall ? endConsultAndResumeHeld() : endActive());
                    }}
                  />
                )}
              </div>

              {/* Compact horizontal toolbar */}
              <div className="border-t border-white/10 bg-zinc-950/95 px-2 py-2 sm:px-4">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
                  {!heldCall && !parked ? (
                    <AddCallParticipant
                      callId={active.callId}
                      type={active.type}
                      compact
                      mode="consult"
                    />
                  ) : null}
                  {!heldCall && !parked ? (
                    <AddCallParticipant
                      callId={active.callId}
                      type={active.type}
                      compact
                      mode="invite"
                    />
                  ) : null}
                  {!parked
                    ? (active.participants.length
                        ? active.participants
                        : rosterFromPeer(active.peerId, active.peerName)
                      ).map((p) => (
                        <Button
                          key={p.id}
                          size="sm"
                          variant="secondary"
                          className="h-9 gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs hover:bg-white/15"
                          onClick={() => void kickParticipant(p.id, p.name)}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          <span className="max-w-[9rem] truncate">End for {p.name}</span>
                        </Button>
                      ))
                    : null}
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
                    onClick={() =>
                      void (heldCall ? endAllCalls() : endActive())
                    }
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    {heldCall ? 'End all' : 'End call'}
                  </Button>
                  {heldCall ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs"
                      onClick={() => void endConsultAndResumeHeld()}
                    >
                      End & resume held
                    </Button>
                  ) : null}
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
