'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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

const PRESENCE_INTERVAL_MS = 45_000;

/** Establishes Socket.io when available, plus HTTP presence heartbeat (works on Vercel). */
export function SocketProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const loggedIn = Boolean(accessToken);

  // HTTP presence — keeps isOnline accurate even when Socket.io is disabled (*.vercel.app).
  useEffect(() => {
    if (!loggedIn) return;

    let cancelled = false;
    const ping = async () => {
      if (!tokenRef.current) return;
      try {
        await api.post('/users/me/presence');
        // Do NOT invalidate discover here — that turned a heartbeat into a query storm.
        if (!cancelled) {
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
  }, [loggedIn, qc]);

  // Connect once per login — do NOT reconnect on every access-token refresh
  // (that caused "WebSocket is closed before the connection is established").
  useEffect(() => {
    if (!loggedIn || !clientEnv.socketEnabled) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const next = io(clientEnv.socketUrl, {
      auth: (cb) => {
        cb({ token: tokenRef.current });
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 8_000,
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
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    next.on(SocketEvents.PresenceOnline, () => {
      // Do not refetch Discover — online filter churn made cards vanish/reappear.
      qc.invalidateQueries({ queryKey: ['admin-online'] });
    });
    next.on(SocketEvents.PresenceOffline, () => {
      qc.invalidateQueries({ queryKey: ['admin-online'] });
    });

    return () => {
      next.off('connect', onConnect);
      next.off('disconnect', onDisconnect);
      next.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [loggedIn, qc]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
  );
}
