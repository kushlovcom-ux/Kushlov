'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { CallType, SocketEvents } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useSocket } from '@/components/socket-provider';
import { useAuthStore } from '@/store/auth';
import { LiveKitStage } from '@/components/live/livekit-stage';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/common/user-avatar';

type IncomingInvite = {
  callId: string;
  type: CallType;
  roomName: string;
  from: { id?: string; displayName?: string; avatarUrl?: string };
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
  role: 'caller' | 'callee';
};

/**
 * Global incoming/outgoing call UI for hosts (accept/reject) and users (in-call).
 */
export function CallOverlay() {
  const socket = useSocket().socket;
  const user = useAuthStore((s) => s.user);
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const [outgoing, setOutgoing] = useState<{
    callId: string;
    type: CallType;
    peerName: string;
    token: string;
    roomName: string;
    livekitUrl?: string;
    maxDurationSec: number;
  } | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const warnedRef = useRef(false);

  const endActive = useCallback(
    async (call?: ActiveCall | null) => {
      const c = call ?? active;
      if (!c) return;
      try {
        await api.post(`/calls/${c.type}/${c.callId}/end`);
      } catch {
        /* already ended */
      }
      setActive(null);
      setOutgoing(null);
      setRemainingSec(null);
      warnedRef.current = false;
    },
    [active],
  );

  useEffect(() => {
    if (!socket || !user) return;

    const onInvite = (payload: IncomingInvite) => {
      // Hosts and normal users can accept/reject incoming calls.
      // Hosts still cannot initiate calls.
      if (user.role === 'admin') return;
      setIncoming(payload);
      toast('Incoming call', {
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
    }) => {
      setOutgoing((prev) => {
        if (!prev || prev.callId !== payload.callId) return prev;
        setActive({
          callId: payload.callId,
          type: payload.type ?? prev.type,
          roomName: payload.roomName ?? prev.roomName,
          token: payload.token,
          livekitUrl: payload.livekitUrl ?? prev.livekitUrl,
          maxDurationSec: payload.maxDurationSec ?? prev.maxDurationSec,
          peerName: prev.peerName,
          role: 'caller',
        });
        return null;
      });
    };

    const onReject = () => {
      setOutgoing(null);
      toast.error('Call declined');
    };

    const onEnd = () => {
      setActive(null);
      setOutgoing(null);
      setIncoming(null);
      setRemainingSec(null);
      toast.message('Call ended');
    };

    socket.on(SocketEvents.CallInvite, onInvite);
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onReject);
    socket.on(SocketEvents.CallEnd, onEnd);

    return () => {
      socket.off(SocketEvents.CallInvite, onInvite);
      socket.off(SocketEvents.CallAccept, onAccept);
      socket.off(SocketEvents.CallReject, onReject);
      socket.off(SocketEvents.CallEnd, onEnd);
    };
  }, [socket, user]);

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
      };
      try {
        const data = await unwrap<{
          call: { _id: string };
          token: string;
          roomName: string;
          livekitUrl?: string;
          maxDurationSec: number;
        }>(api.post('/calls/initiate', { type: detail.type, calleeId: detail.calleeId }));
        setOutgoing({
          callId: data.call._id,
          type: detail.type,
          peerName: detail.peerName,
          token: data.token,
          roomName: data.roomName,
          livekitUrl: data.livekitUrl,
          maxDurationSec: data.maxDurationSec,
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
      const data = await unwrap<{
        token: string;
        roomName: string;
        livekitUrl?: string;
        maxDurationSec: number;
      }>(api.post(`/calls/${incoming.type}/${incoming.callId}/accept`));
      setActive({
        callId: incoming.callId,
        type: incoming.type,
        roomName: data.roomName,
        token: data.token,
        livekitUrl: data.livekitUrl,
        maxDurationSec: data.maxDurationSec,
        peerName: incoming.from?.displayName ?? 'Caller',
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

  if (!incoming && !outgoing && !active) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      {incoming && !active && (
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-card p-6 text-center shadow-2xl">
          <UserAvatar
            name={incoming.from?.displayName}
            src={incoming.from?.avatarUrl}
            className="mx-auto h-20 w-20 text-2xl"
          />
          <p className="mt-4 text-lg font-semibold">{incoming.from?.displayName ?? 'Incoming call'}</p>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-white/50">
            {incoming.type === CallType.Video ? (
              <Video className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            Incoming {incoming.type} call
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button
              size="lg"
              variant="destructive"
              className="h-14 w-14 rounded-full"
              onClick={() => void reject()}
              aria-label="Reject"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600"
              onClick={() => void accept()}
              aria-label="Accept"
            >
              <Phone className="h-6 w-6" />
            </Button>
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
              void endActive({
                callId: outgoing.callId,
                type: outgoing.type,
                roomName: outgoing.roomName,
                token: outgoing.token,
                livekitUrl: outgoing.livekitUrl,
                maxDurationSec: outgoing.maxDurationSec,
                peerName: outgoing.peerName,
                role: 'caller',
              })
            }
          >
            <PhoneOff className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}

      {active && (
        <div className="flex h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-semibold">{active.peerName}</p>
              <p className="text-xs capitalize text-white/50">{active.type} call</p>
            </div>
            <div className="flex items-center gap-3">
              {remainingSec != null && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    remainingSec <= 30 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')} left
                </span>
              )}
              <Button size="icon" variant="ghost" onClick={() => void endActive()} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <LiveKitStage
              token={active.token}
              serverUrl={active.livekitUrl}
              audioOnly={active.type === CallType.Audio}
              isHost={active.role === 'callee'}
              onDisconnected={() => void endActive()}
            />
          </div>
          <div className="flex justify-center border-t border-white/10 p-4">
            <Button variant="destructive" onClick={() => void endActive()}>
              <PhoneOff className="h-4 w-4" /> End call
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fire a global start-call event handled by CallOverlay. */
export function startCall(type: CallType, calleeId: string, peerName: string) {
  window.dispatchEvent(
    new CustomEvent('kushlov:start-call', { detail: { type, calleeId, peerName } }),
  );
}
