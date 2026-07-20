'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { SocketEvents } from '@kushlov/types';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export const useSocket = () => useContext(SocketContext);

const PRESENCE_INTERVAL_MS = 25_000;

/** Establishes Socket.io when available, plus HTTP presence heartbeat (works on Vercel). */
export function SocketProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // HTTP presence — keeps isOnline accurate even when Socket.io is disabled (*.vercel.app).
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    const ping = async () => {
      try {
        await api.post('/users/me/presence');
        if (!cancelled) {
          qc.invalidateQueries({ queryKey: ['discover'] });
          qc.invalidateQueries({ queryKey: ['admin-online'] });
        }
      } catch {
        /* ignore transient errors */
      }
    };

    void ping();
    const id = window.setInterval(ping, PRESENCE_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [accessToken, qc]);

  useEffect(() => {
    if (!accessToken || !clientEnv.socketEnabled) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const next = io(clientEnv.socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 8,
      timeout: 10000,
    });
    setSocket(next);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    next.on('connect', onConnect);
    next.on('disconnect', onDisconnect);

    next.on(SocketEvents.Notification, (n: { title: string; body?: string }) => {
      toast(n.title, { description: n.body });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    next.on(SocketEvents.MessageNew, () => {
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    });

    next.on(SocketEvents.PresenceOnline, () => {
      qc.invalidateQueries({ queryKey: ['discover'] });
      qc.invalidateQueries({ queryKey: ['admin-online'] });
    });
    next.on(SocketEvents.PresenceOffline, () => {
      qc.invalidateQueries({ queryKey: ['discover'] });
      qc.invalidateQueries({ queryKey: ['admin-online'] });
    });

    return () => {
      next.off('connect', onConnect);
      next.off('disconnect', onDisconnect);
      next.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken, qc]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
  );
}
