import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { useCallStore } from '@/store/call';
import { useColiveStore } from '@/store/colive';
import { callsApi } from '@/api/calls';
import { CallStatus, SocketEvents } from '@/types';
import { normalizeCallSession } from '@/utils/normalizeCall';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/queryKeys';
import { dismissIncomingCallNotification } from '@/services/notifications';

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
    const applyMergedRoom = (
      session: ReturnType<typeof normalizeCallSession>,
      raw: {
        mergedFromHold?: string;
        merged?: boolean;
        heldCallId?: string;
        callId?: string;
        token?: string;
        roomName?: string;
        livekitUrl?: string;
        participants?: { id?: string; displayName?: string; name?: string }[];
      },
    ) => {
      const active = useCallStore.getState().active;
      if (!active) return false;
      const heldId = String(raw.mergedFromHold || raw.heldCallId || '');
      const token = session.token || raw.token;
      const isMerge =
        Boolean(raw.merged) ||
        Boolean(heldId) ||
        (Boolean(token) &&
          Boolean(session.roomName) &&
          session.roomName !== active.session.roomName);
      if (!isMerge) return false;
      // Must have a conference token — unparking without it rejoins the empty held room.
      if (!token) return true;

      const roster = (session.participants ?? raw.participants ?? [])
        .filter((p) => p?.id)
        .map((p) => ({
          id: String(p.id),
          name: p.displayName || p.name || 'Peer',
        }));

      const nextRoom = session.roomName || raw.roomName || active.session.roomName;
      // Consult merge always changes rooms — reject stale tokens for the held room.
      if (
        (raw.merged || heldId) &&
        nextRoom &&
        active.session.roomName &&
        nextRoom !== active.session.roomName &&
        token === active.session.token
      ) {
        return true;
      }

      // Apply media credentials BEFORE unparking so LiveKit mounts into the new room.
      useCallStore.getState().updateSession({
        id: session.id || raw.callId || active.session.id,
        type: session.type ?? active.session.type,
        token,
        livekitUrl: session.livekitUrl || raw.livekitUrl || active.session.livekitUrl,
        roomName: nextRoom,
        status: CallStatus.Ongoing,
      });
      if (roster.length) useCallStore.getState().setParticipants(roster);
      useCallStore.getState().markConnected();
      useCallStore.getState().setParkedConsult(null);
      useCallStore.getState().setParked(false);
      return true;
    };

    const onAccept = (payload: unknown) => {
      const session = normalizeCallSession(payload);
      const active = useCallStore.getState().active;
      const raw = (payload ?? {}) as {
        mergedFromHold?: string;
        merged?: boolean;
        heldCallId?: string;
        callId?: string;
        token?: string;
        roomName?: string;
        livekitUrl?: string;
        participants?: { id?: string; displayName?: string; name?: string }[];
      };
      const roster = (session.participants ?? [])
        .filter((p) => p.id)
        .map((p) => ({ id: p.id, name: p.displayName || p.name || 'Peer' }));

      if (active && (raw.merged || raw.mergedFromHold)) {
        if (applyMergedRoom(session, raw)) return;
      }

      if (
        raw.mergedFromHold &&
        active &&
        (String(active.session.id) === String(raw.mergedFromHold) || Boolean(session.token))
      ) {
        applyMergedRoom(session, raw);
        return;
      }

      if (!active) {
        if (session.token || session.id) {
          useCallStore.getState().startCall(
            { ...session, status: CallStatus.Ongoing },
            'caller',
            session.caller ?? session.callee,
          );
          if (roster.length) useCallStore.getState().setParticipants(roster);
        }
        return;
      }

      // Ignore accepts for a different call — unless this is a room switch
      // (merge / consult) that brings a new LiveKit token.
      const roomSwitch =
        Boolean(session.token) &&
        Boolean(session.roomName) &&
        session.roomName !== active.session.roomName;
      if (
        session.id &&
        active.session.id &&
        String(session.id) !== String(active.session.id) &&
        !roomSwitch
      ) {
        return;
      }

      // Prefer server accept fields; never wipe a working token with undefined.
      useCallStore.getState().updateSession({
        id: session.id || active.session.id,
        type: session.type || active.session.type,
        status: CallStatus.Ongoing,
        token: session.token || active.session.token,
        livekitUrl: session.livekitUrl || active.session.livekitUrl,
        roomName: session.roomName || active.session.roomName,
      });
      if (roomSwitch) useCallStore.getState().setParked(false);
      useCallStore.getState().markConnected();
      if (roster.length) {
        useCallStore.getState().setParticipants(roster);
      } else if (session.callee || session.caller) {
        const peer = active.role === 'caller' ? session.callee : session.caller;
        if (peer?.id && !(active.participants ?? []).some((p) => p.id === peer.id)) {
          useCallStore.getState().setParticipants([
            ...(active.participants ?? []),
            { id: peer.id, name: peer.displayName ?? 'Peer' },
          ]);
        }
      }
    };

    const resumeHeld = async () => {
      const held = useCallStore.getState().heldCall;
      if (!held) return;
      try {
        const session = await callsApi.unhold(held.type, held.callId);
        useCallStore.getState().setHeldCall(null);
        useCallStore.getState().startCall(session, 'caller', held.peer);
      } catch {
        useCallStore.getState().setHeldCall(null);
      }
    };

    const idsMatch = (a?: string, b?: string) => Boolean(a) && Boolean(b) && String(a) === String(b);

    const hangUpActive = (resumeIfHeld: boolean) => {
      const heldNow = useCallStore.getState().heldCall;
      if (resumeIfHeld && heldNow) {
        useCallStore.setState({ active: null, incoming: null, parked: false });
        void resumeHeld();
        return;
      }
      clearCall();
    };

    const onRejectOrEnd = (payload?: { callId?: string; interrupt?: boolean; userId?: string }) => {
      const id = payload?.callId ? String(payload.callId) : undefined;
      const active = useCallStore.getState().active;
      const incoming = useCallStore.getState().incoming;
      const held = useCallStore.getState().heldCall;
      const activeId = active?.session?.id ? String(active.session.id) : '';
      const incomingId = incoming?.id ? String(incoming.id) : '';
      const heldId = held?.callId ? String(held.callId) : '';
      const ringing =
        active?.session.status === CallStatus.Ringing ||
        String(active?.session.status ?? '') === 'ringing';

      if (idsMatch(id, heldId)) {
        useCallStore.getState().setHeldCall(null);
        return;
      }

      // Incoming invite / call-waiting for US was declined — keep the current call.
      if (idsMatch(id, incomingId) && !idsMatch(id, activeId)) {
        setIncoming(null);
        void dismissIncomingCallNotification(id);
        return;
      }
      if (payload?.interrupt && incoming && (!id || idsMatch(id, incomingId)) && !idsMatch(id, activeId)) {
        setIncoming(null);
        void dismissIncomingCallNotification(incomingId || id);
        return;
      }

      // We are the caller still ringing (1:1 or consult / call-waiting we placed).
      // Peer reject must drop this overlay — do not leave A sitting in LiveKit.
      if (active && ringing && (!id || !activeId || idsMatch(id, activeId))) {
        hangUpActive(true);
        return;
      }

      if (!active) {
        if (incoming && (!id || idsMatch(id, incomingId))) {
          setIncoming(null);
          void dismissIncomingCallNotification(incomingId || id);
        }
        return;
      }

      // Secondary invitee declined an ongoing conference — do not hang up A↔B.
      if (payload?.userId && active.session.status === CallStatus.Ongoing && idsMatch(id, activeId)) {
        return;
      }

      // Consult we placed ended while a held line exists → resume held.
      if (held && (!id || idsMatch(id, activeId))) {
        hangUpActive(true);
        return;
      }

      if (!id || idsMatch(id, activeId)) {
        hangUpActive(false);
      } else if (idsMatch(id, incomingId)) {
        setIncoming(null);
        void dismissIncomingCallNotification(id);
      }
    };

    const onHold = (payload: {
      callId?: string;
      type?: string;
      consultCallId?: string;
      consultType?: string;
    }) => {
      const active = useCallStore.getState().active;
      if (
        !active ||
        (payload.callId && String(payload.callId) !== String(active.session.id))
      ) {
        return;
      }
      useCallStore.getState().setParked(true);
      const consultId = payload.consultCallId ? String(payload.consultCallId) : '';
      if (consultId) {
        useCallStore.getState().setParkedConsult({
          callId: consultId,
          type: (payload.consultType || payload.type || active.session.type) as typeof active.session.type,
        });
      }
    };

    const onUnhold = (payload: {
      callId?: string;
      heldCallId?: string;
      merged?: boolean;
      mergedFromHold?: string;
      token?: string;
      roomName?: string;
      livekitUrl?: string;
      maxDurationSec?: number;
      status?: string;
      type?: string;
      participants?: { id?: string; displayName?: string; name?: string }[];
    }) => {
      if (payload.merged || payload.mergedFromHold) {
        const session = normalizeCallSession(payload);
        // Stay parked if the server omitted the conference token — CallAccept may follow.
        if (!payload.token && !session.token) return;
        applyMergedRoom(session, payload);
        return;
      }
      const active = useCallStore.getState().active;
      if (
        !active ||
        (payload.callId && String(payload.callId) !== String(active.session.id))
      ) {
        return;
      }
      if (payload.token) {
        useCallStore.getState().updateSession({
          token: payload.token,
          roomName: payload.roomName ?? active.session.roomName,
          livekitUrl: payload.livekitUrl ?? active.session.livekitUrl,
          status: CallStatus.Ongoing,
        });
      }
      useCallStore.getState().setParked(false);
    };

    const onParticipantLeft = (payload: {
      endedForYou?: boolean;
      userId?: string;
    }) => {
      if (payload?.endedForYou) {
        clearCall();
        return;
      }
      const leftId = payload?.userId;
      if (!leftId) return;
      const active = useCallStore.getState().active;
      if (!active) return;
      useCallStore.getState().setParticipants(
        (active.participants ?? []).filter((p) => p.id !== leftId),
      );
    };

    const onParticipantJoined = (payload: {
      participant?: { id?: string; displayName?: string };
    }) => {
      const id = payload?.participant?.id;
      if (!id) return;
      const active = useCallStore.getState().active;
      if (!active) return;
      if ((active.participants ?? []).some((p) => p.id === id)) return;
      useCallStore.getState().setParticipants([
        ...(active.participants ?? []),
        { id, name: payload.participant?.displayName ?? 'Peer' },
      ]);
    };
    const onMessage = (payload?: { conversation?: string; conversationId?: string }) => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
      qc.invalidateQueries({ queryKey: ['chat', 'messages'] });
      const convId = payload?.conversation ?? payload?.conversationId;
      if (convId) {
        qc.invalidateQueries({ queryKey: queryKeys.messages(String(convId)) });
      }
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
    socket.on(SocketEvents.CallHold, onHold);
    socket.on(SocketEvents.CallUnhold, onUnhold);
    socket.on(SocketEvents.CallParticipantLeft, onParticipantLeft);
    socket.on(SocketEvents.CallParticipantJoined, onParticipantJoined);
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
      s?.off(SocketEvents.CallHold, onHold);
      s?.off(SocketEvents.CallUnhold, onUnhold);
      s?.off(SocketEvents.CallParticipantLeft, onParticipantLeft);
      s?.off(SocketEvents.CallParticipantJoined, onParticipantJoined);
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
