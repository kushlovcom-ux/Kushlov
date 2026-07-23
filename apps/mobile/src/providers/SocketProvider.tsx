import React, { useEffect } from 'react';
import { Alert } from 'react-native';
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

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    const socket = connectSocket(token);

    const onInvite = (payload: unknown) => {
      setIncoming(normalizeCallSession(payload));
    };
    const onAccept = (payload: unknown) => {
      const session = normalizeCallSession(payload);
      updateSession({ ...session, status: CallStatus.Ongoing });
    };
    const onEnd = () => {
      clearCall();
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
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onEnd);
    socket.on(SocketEvents.CallEnd, onEnd);
    socket.on(SocketEvents.MessageNew, onMessage);
    socket.on(SocketEvents.Notification, onNotification);
    socket.on(SocketEvents.LiveColiveInvite, onColiveInvite);

    return () => {
      const s = getSocket();
      s?.off(SocketEvents.CallInvite, onInvite);
      s?.off(SocketEvents.CallAccept, onAccept);
      s?.off(SocketEvents.CallReject, onEnd);
      s?.off(SocketEvents.CallEnd, onEnd);
      s?.off(SocketEvents.MessageNew, onMessage);
      s?.off(SocketEvents.Notification, onNotification);
      s?.off(SocketEvents.LiveColiveInvite, onColiveInvite);
    };
  }, [token, setIncoming, updateSession, clearCall, qc]);

  return <>{children}</>;
}

/** Lightweight socket accessor for chat screens */
export function useSocket() {
  return {
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const s = getSocket();
      s?.on(event, handler);
      return () => {
        s?.off(event, handler);
      };
    },
    emit: (event: string, payload?: unknown) => {
      getSocket()?.emit(event, payload);
    },
  };
}
