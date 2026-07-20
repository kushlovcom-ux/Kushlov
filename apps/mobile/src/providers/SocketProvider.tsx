import React, { useEffect } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';
import { useCallStore } from '@/store/call';
import { CallStatus, SocketEvents, type CallSession } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/constants/queryKeys';

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

    const onInvite = (payload: CallSession) => {
      setIncoming(payload);
    };
    const onAccept = (payload: CallSession) => {
      updateSession({ ...payload, status: CallStatus.Ongoing });
    };
    const onEnd = () => {
      clearCall();
    };
    const onMessage = () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations });
    };
    const onNotification = () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
      qc.invalidateQueries({ queryKey: queryKeys.badges });
    };

    socket.on(SocketEvents.CallInvite, onInvite);
    socket.on(SocketEvents.CallAccept, onAccept);
    socket.on(SocketEvents.CallReject, onEnd);
    socket.on(SocketEvents.CallEnd, onEnd);
    socket.on(SocketEvents.MessageNew, onMessage);
    socket.on(SocketEvents.Notification, onNotification);

    return () => {
      const s = getSocket();
      s?.off(SocketEvents.CallInvite, onInvite);
      s?.off(SocketEvents.CallAccept, onAccept);
      s?.off(SocketEvents.CallReject, onEnd);
      s?.off(SocketEvents.CallEnd, onEnd);
      s?.off(SocketEvents.MessageNew, onMessage);
      s?.off(SocketEvents.Notification, onNotification);
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
