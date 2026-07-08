'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { SocketEvents } from '@kushlov/types';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/store/auth';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

/** Establishes an authenticated Socket.io connection tied to the session. */
export function SocketProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // No session, or realtime disabled (e.g. serverless backend without a
    // dedicated WebSocket host) — don't attempt to connect.
    if (!accessToken || !clientEnv.socketEnabled) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(clientEnv.socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on(SocketEvents.Notification, (n: { title: string; body?: string }) => {
      toast(n.title, { description: n.body });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on(SocketEvents.MessageNew, () => {
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, qc]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
