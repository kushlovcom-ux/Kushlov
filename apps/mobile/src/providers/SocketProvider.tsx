import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { useCallStore } from '@/store/call';
import { useColiveStore } from '@/store/colive';
import { CallStatus, SocketEvents } from '@/types';
import { normalizeCallSession } from '@/utils/normalizeCall';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/queryKeys';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const updateSession = useCallStore((s) => s.updateSession);
  const clearCall = useCallStore((s) => s.clear);
  const setColiveInvite = useColiveStore((s) => s.setInvite);
  const qc = useQueryClient();
  const [, setConnectedTick] = useState(0);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setConnectedTick((n) => n + 1);
      return;
    }
    const socket = connectSocket(token);

    const bump = () => setConnectedTick((n) => n + 1);
    socket.on('connect', bump);
    socket.on('disconnect', bump);

    const onInvite = (payload: unknown) => {
      setIncoming(normalizeCallSession(payload));
    };
    const onAccept = (payload: unknown) => {
      const session = normalizeCallSession(payload);
      const active = useCallStore.getState().active;
      if (active && (session.interrupt || !active.session.token)) {
        useCallStore.getState().updateSession({
          ...session,
          status: CallStatus.Ongoing,
          token: session.token ?? active.session.token,
          livekitUrl: session.livekitUrl ?? active.session.livekitUrl,
        });
      } else {
        updateSession({ ...session, status: CallStatus.Ongoing });
      }
    };
    const onRejectOrEnd = (payload?: { callId?: string; interrupt?: boolean }) => {
      const id = payload?.callId;
      const active = useCallStore.getState().active;
      const incoming = useCallStore.getState().incoming;

      // Ending/rejecting a call-waiting interrupt must not wipe A↔B.
      if (id && active?.session?.id && id !== active.session.id) {
        if (incoming?.id === id) setIncoming(null);
        return;
      }
      if (payload?.interrupt && active) {
        if (incoming?.id === id || !id) setIncoming(null);
        return;
      }

      if (incoming && (!id || incoming.id === id) && !active) {
        setIncoming(null);
        return;
      }

      if (!active || !id || active.session.id === id) {
        clearCall();
      } else if (incoming?.id === id) {
        setIncoming(null);
      }
    };
    const onParticipantLeft = (payload: { endedForYou?: boolean }) => {
      if (payload?.endedForYou) clearCall();
    };
    const onMessage = () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
    };
    const onNotification = () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
    };

    const onColiveInvite = (payload: {
      liveId: string;
      title?: string;
      from?: { displayName?: string; id?: string; avatarUrl?: string };
    }) => {
      if (!payload?.liveId) return;
      setColiveInvite(payload);
    };

    socket.on(SocketEvents.CallInvite, onInvite);
    socket.on(SocketEvents.CallWaiting, onInvite);
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onRejectOrEnd);
    socket.on(SocketEvents.CallEnd, onRejectOrEnd);
    socket.on(SocketEvents.CallParticipantLeft, onParticipantLeft);
    socket.on(SocketEvents.MessageNew, onMessage);
    socket.on(SocketEvents.Notification, onNotification);
    socket.on(SocketEvents.LiveColiveInvite, onColiveInvite);

    bump();

    return () => {
      const s = getSocket();
      s?.off('connect', bump);
      s?.off('disconnect', bump);
      s?.off(SocketEvents.CallInvite, onInvite);
      s?.off(SocketEvents.CallWaiting, onInvite);
      s?.off(SocketEvents.CallAccept, onAccept);
      s?.off(SocketEvents.CallReject, onRejectOrEnd);
      s?.off(SocketEvents.CallEnd, onRejectOrEnd);
      s?.off(SocketEvents.CallParticipantLeft, onParticipantLeft);
      s?.off(SocketEvents.MessageNew, onMessage);
      s?.off(SocketEvents.Notification, onNotification);
      s?.off(SocketEvents.LiveColiveInvite, onColiveInvite);
    };
  }, [token, setIncoming, updateSession, clearCall, setColiveInvite, qc]);

  return <>{children}</>;
}

type SocketApi = {
  connected: boolean;
  get: () => Socket | null;
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
  emit: (event: string, payload?: unknown) => void;
};

/** Stable socket accessor — identity does not change every render. */
export function useSocket(): SocketApi {
  const socket = getSocket();
  const connected = !!socket?.connected;

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const s = getSocket();
    s?.on(event, handler);
    return () => {
      getSocket()?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    getSocket()?.emit(event, payload);
  }, []);

  const get = useCallback(() => getSocket(), []);

  return useMemo(() => ({ connected, get, on, emit }), [connected, get, on, emit]);
}
