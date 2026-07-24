import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { useCallStore } from '@/store/call';
import { CallStatus, SocketEvents } from '@/types';
import { normalizeCallSession } from '@/utils/normalizeCall';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/queryKeys';
import { liveApi } from '@/api/live';
import { navigationRef } from '@/navigation/navigationRef';
import { getErrorMessage } from '@/api/client';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const updateSession = useCallStore((s) => s.updateSession);
  const clearCall = useCallStore((s) => s.clear);
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
    const onEnd = () => {
      clearCall();
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
      from?: { displayName?: string };
    }) => {
      Alert.alert(
        'Co-live invite',
        `${payload.from?.displayName ?? 'A host'} invited you to join “${payload.title ?? 'their stream'}”`,
        [
          { text: 'Decline', style: 'cancel' },
          {
            text: 'Join',
            onPress: () => {
              void (async () => {
                try {
                  await liveApi.coliveAccept(payload.liveId);
                  if (navigationRef.isReady()) {
                    navigationRef.navigate('App', {
                      screen: 'LiveRoom',
                      params: { liveId: payload.liveId },
                    } as never);
                  }
                } catch (err) {
                  Alert.alert('Co-live', getErrorMessage(err));
                }
              })();
            },
          },
        ],
      );
    };

    socket.on(SocketEvents.CallInvite, onInvite);
    socket.on(SocketEvents.CallWaiting, onInvite);
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onEnd);
    socket.on(SocketEvents.CallEnd, onEnd);
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
      s?.off(SocketEvents.CallReject, onEnd);
      s?.off(SocketEvents.CallEnd, onEnd);
      s?.off(SocketEvents.CallParticipantLeft, onParticipantLeft);
      s?.off(SocketEvents.MessageNew, onMessage);
      s?.off(SocketEvents.Notification, onNotification);
      s?.off(SocketEvents.LiveColiveInvite, onColiveInvite);
    };
  }, [token, setIncoming, updateSession, clearCall, qc]);

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
